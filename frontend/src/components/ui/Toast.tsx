import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ToastItem, ToastVariant } from '../../lib/toast-context';

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const VARIANT_ICON_CLASS: Record<ToastVariant, string> = {
  success: 'text-status-good',
  error: 'text-status-critical',
  info: 'text-ink-secondary',
};

function roleFor(variant: ToastVariant): 'alertdialog' | 'dialog' {
  return variant === 'error' ? 'alertdialog' : 'dialog';
}

/**
 * A single toast, rendered as a centered popup with a required "OK" —
 * not an auto-fading corner notification — so the reporter/responder has
 * unambiguous confirmation their action actually happened. Backdrop +
 * dialog semantics reuse Modal.tsx's own pattern for visual/behavioral
 * consistency, but this lives outside Modal itself since it queues
 * (ToastContainer below) and needs no title bar or close (×) button —
 * OK is the only way out, on purpose.
 */
export function Toast({ message, variant, onDismiss }: { message: string; variant: ToastVariant; onDismiss: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const Icon = VARIANT_ICON[variant];

  useEffect(() => {
    okRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') onDismiss();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      // Above every other overlay tier in the app (Modal 1200, CameraOverlay
      // 1400) — a toast reports the outcome of whatever the user just did,
      // including inside those, so it must never end up hidden behind one.
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-ink/40 px-5"
    >
      <div
        role={roleFor(variant)}
        aria-modal="true"
        aria-label={message}
        className="bg-surface flex w-full max-w-sm flex-col items-center gap-3 rounded-xl p-6 text-center shadow-lg"
      >
        <Icon className={cn('h-10 w-10', VARIANT_ICON_CLASS[variant])} aria-hidden />
        <p className="text-ink text-sm font-medium">{message}</p>
        <button
          ref={okRef}
          type="button"
          onClick={onDismiss}
          className="bg-brand mt-1 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Renders only the head of the queue — see toast-context.tsx for why. */
export function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  const current = toasts[0];
  if (!current) return null;

  return <Toast key={current.id} message={current.message} variant={current.variant} onDismiss={() => onDismiss(current.id)} />;
}
