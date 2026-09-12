import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Full-viewport camera chrome shared by PhotoCaptureControl and
 * MediaRecorderControl's video mode — matches the "fills the screen while
 * actively capturing" pattern of a native camera app (WhatsApp, etc.)
 * rather than a small inline preview box. Portals to <body> like Modal, but
 * deliberately outranks it (z-[1400] vs Modal's z-[1200]): live camera
 * hardware access should never end up visually buried under other chrome.
 */
export function CameraOverlay({
  children,
  topRight,
  bottomControls,
  onClose,
  closeLabel = 'Close camera',
}: {
  /** The live/preview <video> element, filling the overlay behind the chrome. */
  children: ReactNode;
  /** Extra content in the top bar, e.g. a recording timer — right-aligned. */
  topRight?: ReactNode;
  bottomControls: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[1400] flex flex-col bg-black">
      <div className="absolute inset-0">{children}</div>

      <div className="relative flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="rounded-full bg-black/45 p-2.5 text-white backdrop-blur-sm active:scale-95"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {topRight}
      </div>

      <div className="relative mt-auto flex flex-col items-center gap-4 p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        {bottomControls}
      </div>
    </div>,
    document.body,
  );
}

/** The big circular shutter/record/stop button camera apps use. */
export function ShutterButton({
  onClick,
  variant,
  label,
}: {
  onClick: () => void;
  variant: 'photo' | 'record' | 'stop';
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-[3px] border-white active:scale-95"
    >
      {variant === 'stop' ? (
        <span className="bg-status-critical h-7 w-7 rounded-[6px]" aria-hidden />
      ) : (
        <span className={variant === 'record' ? 'bg-status-critical h-[60px] w-[60px] rounded-full' : 'h-[60px] w-[60px] rounded-full bg-white'} aria-hidden />
      )}
    </button>
  );
}
