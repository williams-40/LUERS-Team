import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { CameraOverlay, ShutterButton } from './CameraOverlay';

type CaptureState = 'idle' | 'requesting' | 'previewing' | 'captured' | 'unsupported' | 'denied';

export function PhotoCaptureControl({ onCapture }: { onCapture: (file: File | null) => void }) {
  const [state, setState] = useState<CaptureState>('idle');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      stopStream();
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The live preview <video> only exists once the 'previewing' branch
  // renders, so the stream has to be (re)attached here rather than inline.
  useEffect(() => {
    if (state === 'previewing' && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [state]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    setState('requesting');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setState('previewing');
    } catch {
      setState('denied');
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopStream();
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        setPhotoUrl(URL.createObjectURL(blob));
        setState('captured');
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.85,
    );
  }

  function retake() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    onCapture(null);
    void openCamera();
  }

  function removePhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    onCapture(null);
    setState('idle');
  }

  function cancelPreview() {
    stopStream();
    setState('idle');
  }

  if (state === 'unsupported') {
    return <p className="text-status-critical text-xs">Camera capture isn't supported in this browser.</p>;
  }

  if (state === 'denied') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-status-critical text-xs">
          Camera access was denied. Allow access in your browser settings to attach a photo.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={openCamera} className="self-start">
          Try again
        </Button>
      </div>
    );
  }

  if (state === 'captured' && photoUrl) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-status-good text-xs font-semibold">Photo attached. You can retake or remove it below.</p>
        <img src={photoUrl} alt="Captured evidence preview" className="max-h-48 w-auto rounded-[9px] object-contain" />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={retake}>
            Retake
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={removePhoto}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'previewing') {
    return (
      <CameraOverlay
        onClose={cancelPreview}
        closeLabel="Cancel"
        bottomControls={<ShutterButton onClick={capture} variant="photo" label="Take photo" />}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
      </CameraOverlay>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={openCamera}
      disabled={state === 'requesting'}
      className="self-start"
    >
      {state === 'requesting' ? 'Requesting access…' : 'Attach a photo'}
    </Button>
  );
}
