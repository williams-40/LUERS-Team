import { useEffect, useRef, useState } from 'react';
import fixWebmDuration from 'fix-webm-duration';
import { Button } from '../ui/Button';
import { CameraOverlay, ShutterButton } from './CameraOverlay';
import { MAX_EVIDENCE_FILE_SIZE } from '../../lib/evidence-constraints';

type RecordingMode = 'audio' | 'video';
type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'too_large' | 'unsupported' | 'denied';

// MediaRecorder's default output container in Chrome/Firefox — used for both
// audio-only and video capture, no MP4 support without extra codec work.
// The extension differs by mode (.weba vs .webm) so the backend can tell an
// audio recording apart from a video one (see apps/core/file_validation.py
// — the bytes are otherwise identical EBML/Matroska containers).
const MIME_TYPE = 'video/webm';
const EXTENSION: Record<RecordingMode, string> = { audio: '.weba', video: '.webm' };
const FILE_TYPE: Record<RecordingMode, string> = { audio: 'audio/webm', video: 'video/webm' };

// A hard 2-minute cap, enforced by stopping the recorder automatically —
// unlike the byte-based cutoff this replaces, this is generous enough that
// it's essentially never hit by a normal incident description, so it never
// feels like the recording was cut short arbitrarily.
const MAX_RECORDING_SECONDS = 120;

// Explicit (lowish) target bitrates are the actual "automatic compression"
// here — MediaRecorder has no separate compress-after-the-fact step, so the
// only lever is asking the browser's own encoder to target a smaller
// output up front. At these rates a full 2-minute recording lands around
// 15-20MB, comfortably inside MAX_EVIDENCE_FILE_SIZE even before the
// too-large fallback below ever needs to kick in.
const VIDEO_BITS_PER_SECOND = 1_000_000; // 1 Mbps
const AUDIO_BITS_PER_SECOND = 128_000; // 128 kbps

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaRecorderControl({
  mode,
  onRecordingChange,
  autoStart = false,
}: {
  mode: RecordingMode;
  onRecordingChange: (file: File | null) => void;
  /**
   * Starts recording immediately on mount instead of waiting for a
   * "Start recording" tap — e.g. picking the Voice tab is itself the
   * "start" gesture, so a reporter shouldn't need a second click just to
   * begin. Only fires once, on mount (not on every re-render) — the
   * caller is expected to force a fresh mount (e.g. a `key` tied to the
   * mode) when the user re-selects this mode. "Re-record" and "Try
   * again" after a denied/failed attempt stay manual either way, since
   * those are deliberate follow-up actions, not the initial pick.
   */
  autoStart?: boolean;
}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hitTimeLimit, setHitTimeLimit] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedAtRef = useRef(0);

  useEffect(
    () => () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Mount-only, deliberately — re-running on every render would restart a
  // recording already in progress. The caller forces a fresh mount (a
  // `key` tied to the mode) each time the user re-picks Voice, which is
  // exactly when this should fire again.
  useEffect(() => {
    if (autoStart) void startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The live <video> preview element only exists once the 'recording' branch
  // renders, so the stream has to be (re)attached here rather than inline.
  useEffect(() => {
    if (state === 'recording' && mode === 'video' && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [state, mode]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('unsupported');
      return;
    }

    setState('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video' ? { facingMode: 'environment' } : false,
      });
    } catch {
      setState('denied');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    bytesRef.current = 0;
    setSeconds(0);
    setHitTimeLimit(false);

    const recorder = new MediaRecorder(stream, {
      mimeType: MIME_TYPE,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      ...(mode === 'video' ? { videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : {}),
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      bytesRef.current += event.data.size;
      chunksRef.current.push(event.data);
      // Stopping is still the user's call up to the 2-minute cap below — no
      // premature cutoff before that. The evidence size cap is enforced
      // after the fact in onstop, where an oversized recording (unlikely at
      // these bitrates, but possible for a long low-motion video) gets a
      // clear "too long, re-record" message instead of being silently
      // truncated mid-recording.
    };

    recorder.onstop = async () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      // The playback <video> below reuses this same DOM node (React only
      // diffs props at the same tree position, and neither element carries
      // a `key`) — srcObject was set imperatively here for the live
      // preview, outside React's prop diffing, so it's never otherwise
      // cleared. A non-null srcObject silently takes priority over `src`
      // on a media element, so without this the "review" player kept
      // showing the now-frozen live camera feed (stuck at 0:00, play does
      // nothing) instead of ever loading the recorded blob.
      if (videoRef.current) videoRef.current.srcObject = null;

      const rawBlob = new Blob(chunksRef.current, { type: FILE_TYPE[mode] });
      // MediaRecorder's WebM output has no duration written into its
      // container — Chrome in particular then fails to play the blob back
      // in a <video>/<audio> element (shows as frozen/unseekable) until
      // that's patched in. fix-webm-duration appends the missing EBML
      // Duration section using our own measured wall-clock elapsed time.
      const duration = Date.now() - startedAtRef.current;
      const blob = await fixWebmDuration(rawBlob, duration, { logger: false });

      if (blob.size > MAX_EVIDENCE_FILE_SIZE) {
        setState('too_large');
        onRecordingChange(null);
        return;
      }

      const file = new File([blob], `recording${EXTENSION[mode]}`, { type: FILE_TYPE[mode] });
      setPreviewUrl(URL.createObjectURL(blob));
      setState('recorded');
      onRecordingChange(file);
    };

    recorder.start(1000);
    startedAtRef.current = Date.now();
    setState('recording');
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          setHitTimeLimit(true);
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setState('idle');
    setSeconds(0);
    onRecordingChange(null);
  }

  if (state === 'unsupported') {
    return (
      <p className="text-status-critical text-xs">
        Recording isn't supported in this browser. Use text instead, or switch browsers.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-status-critical text-xs">
          {mode === 'video' ? 'Camera and microphone' : 'Microphone'} access was denied. Allow access in your
          browser settings, or use text instead.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={startRecording}>
          Try again
        </Button>
      </div>
    );
  }

  if (state === 'too_large') {
    const maxMb = MAX_EVIDENCE_FILE_SIZE / (1024 * 1024);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-status-critical text-xs">
          That recording is too large ({formatSeconds(seconds)}, over the {maxMb}MB limit). Please re-record a
          shorter or lower-motion clip.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={reRecord} className="self-start">
          Re-record
        </Button>
      </div>
    );
  }

  if (state === 'recorded' && previewUrl) {
    return (
      <div className="flex flex-col gap-2">
        {mode === 'video' ? (
          // key="playback" forces a fresh DOM node rather than reusing the
          // live-preview element from the 'recording' state — see the
          // srcObject note in onstop above for why that matters.
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key="playback" src={previewUrl} controls className="max-h-64 rounded-[9px]" />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={previewUrl} controls className="w-full" />
        )}
        {hitTimeLimit && (
          <p className="text-status-warning text-xs">
            Stopped automatically at the {MAX_RECORDING_SECONDS / 60}-minute recording limit.
          </p>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={reRecord} className="self-start">
          Re-record
        </Button>
      </div>
    );
  }

  if (state === 'recording' && mode === 'video') {
    return (
      <CameraOverlay
        onClose={stopRecording}
        closeLabel="Stop recording"
        topRight={
          <div className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-sm">
            <span className="bg-status-critical h-2 w-2 shrink-0 animate-pulse rounded-full motion-reduce:animate-none" aria-hidden />
            <span className="text-sm tabular-nums text-white">{formatSeconds(seconds)} / {formatSeconds(MAX_RECORDING_SECONDS)}</span>
          </div>
        }
        bottomControls={<ShutterButton onClick={stopRecording} variant="stop" label="Stop recording" />}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video key="live" ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
      </CameraOverlay>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <span className="bg-status-critical h-2.5 w-2.5 shrink-0 animate-pulse rounded-full motion-reduce:animate-none" aria-hidden />
        <span className="text-ink-secondary text-sm tabular-nums">{formatSeconds(seconds)} / {formatSeconds(MAX_RECORDING_SECONDS)}</span>
        <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
          Stop recording
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={startRecording}
      disabled={state === 'requesting'}
      className="self-start"
    >
      {state === 'requesting'
        ? 'Requesting access…'
        : mode === 'video'
          ? 'Start recording video'
          : 'Start recording voice note'}
    </Button>
  );
}
