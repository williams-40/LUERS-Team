import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * First true modal primitive in this codebase — every other mutating flow
 * (delete confirmation via window.confirm, etc.) stays inline-on-page.
 * Built for FeedbackModal, which the spec explicitly asks to appear as
 * "a popup/modal."
 */
export function Modal({
  title,
  onClose,
  dismissible = true,
  children,
}: {
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    if (!dismissible) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, onClose]);

  return createPortal(
    <div
      // Leaflet's own stylesheet gives its controls z-index up to 1000
      // (.leaflet-top/.leaflet-bottom) and its container's position:relative
      // alone doesn't establish a new stacking context, so a map on the
      // page underneath (e.g. ReportLocationMap) can render above a modal
      // at the more typical z-50 — stay comfortably clear of that.
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-ink/40 px-5"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full max-w-md rounded-xl p-5 shadow-lg outline-none"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-ink-muted shrink-0 text-xl leading-none hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
