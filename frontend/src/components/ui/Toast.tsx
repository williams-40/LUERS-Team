import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import type { ToastItem, ToastVariant } from '../../lib/toast-context';

const toastVariants = cva('flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm shadow-lg', {
  variants: {
    variant: {
      success: 'bg-status-good/15 text-status-good-ink',
      error: 'bg-status-critical/15 text-status-critical',
      info: 'bg-ink-muted/15 text-ink-secondary',
    },
  },
  defaultVariants: { variant: 'info' },
});

function roleFor(variant: ToastVariant): 'alert' | 'status' {
  return variant === 'error' ? 'alert' : 'status';
}

interface ToastProps extends VariantProps<typeof toastVariants> {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

export function Toast({ message, variant, onDismiss, className }: ToastProps & { className?: string }) {
  return (
    <div role={roleFor(variant)} aria-atomic="true" className={cn(toastVariants({ variant }), className)}>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 font-semibold opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-5 bottom-[calc(1.25rem+var(--action-bar-offset,0px))] z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}
