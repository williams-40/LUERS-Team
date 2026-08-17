import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { MAX_EVIDENCE_FILE_SIZE } from '../../lib/evidence-constraints';

type RecordingMode = 'audio' | 'video';
type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'unsupported' | 'denied';

// MediaRecorder's default output container in Chrome/Firefox — used for both
// audio-only and video capture, no MP4 support without extra codec work.
// The extension differs by mode (.weba vs .webm) so the backend can tell an
// audio recording apart from a video one (see apps/core/file_validation.py
// — the bytes are otherwise identical EBML/Matroska containers).
const MIME_TYPE = 'video/webm';
const EXTENSION: Record<RecordingMode, string> = { audio: '.weba', video: '.webm' };
const FILE_TYPE: Record<RecordingMode, string> = { audio: 'audio/webm', video: 'video/webm' };

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaRecorderControl({
  mode,
  onRecordingChange,
}: {
  mode: RecordingMode;
  onRecordingChange: (file: File | null) => void;
}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

    const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      bytesRef.current += event.data.size;
      chunksRef.current.push(event.data);
      // Enforce the same 5MB evidence cap recordings are subject to once
      // uploaded — stop automatically rather than let the user record past
      // it and then discover the failure at submit time.
      if (bytesRef.current >= MAX_EVIDENCE_FILE_SIZE) {
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);

      const blob = new Blob(chunksRef.current, { type: FILE_TYPE[mode] });
      const file = new File([blob], `recording${EXTENSION[mode]}`, { type: FILE_TYPE[mode] });
      setPreviewUrl(URL.createObjectURL(blob));
      setState('recorded');
      onRecordingChange(file);
    };

    recorder.start(1000);
    setState('recording');
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
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

  if (state === 'recorded' && previewUrl) {
    return (
      <div className="flex flex-col gap-2">
        {mode === 'video' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={previewUrl} controls className="max-h-64 rounded-[9px]" />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={previewUrl} controls className="w-full" />
        )}
        <Button type="button" variant="ghost" size="sm" onClick={reRecord} className="self-start">
          Re-record
        </Button>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <span className="bg-status-critical h-2.5 w-2.5 shrink-0 animate-pulse rounded-full" aria-hidden />
        <span className="text-ink-secondary text-sm tabular-nums">{formatSeconds(seconds)}</span>
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
