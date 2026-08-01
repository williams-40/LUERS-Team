import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import type { ToastItem, ToastVariant } from '../../lib/toast-context';

const toastVariants = cva('flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm shadow-lg', {
  variants: {
    variant: {
      success: 'bg-status-good/15 text-[#0a6b0a]',
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
    <div role={roleFor(variant)} className={cn(toastVariants({ variant }), className)}>
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
    <div className="fixed right-5 bottom-5 z-50 flex flex-col gap-2">
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
