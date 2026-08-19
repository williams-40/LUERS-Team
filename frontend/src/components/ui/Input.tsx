import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Consolidates the `border-[1.5px] border-ink/15` field styling that was
 * previously copy-pasted across ~15 files. Wires label/error/helperText
 * through aria-invalid + aria-describedby, matching the pattern already
 * used ad hoc in ReportCreatePage/ChangePasswordForm.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-ink-secondary text-[12.5px] font-semibold">
            {label}
            {required && <span className="text-status-critical ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(errorId, helperId) || undefined}
          className={cn(
            'border-[1.5px] border-ink/15 bg-surface-2 text-ink appearance-none rounded-lg px-3.5 py-2.5 text-sm outline-none transition',
            // Native form controls can pick up the OS/browser's own dark-mode
            // widget theme (driven by the page's color-scheme) and ignore an
            // author background-color unless appearance is reset — without
            // this, dark mode showed a white box here despite the right class.
            'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/30',
            'disabled:opacity-50 disabled:pointer-events-none',
            error && 'border-status-critical focus-visible:border-status-critical focus-visible:outline-status-critical/30',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-status-critical text-[12.5px]">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-ink-muted text-[12.5px]">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
