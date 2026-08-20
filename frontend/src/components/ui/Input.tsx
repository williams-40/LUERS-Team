import { type InputHTMLAttributes, forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  ({ className, label, error, helperText, id, required, type, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const isPassword = type === 'password';
    // Applies to every password field in the app (Login, Register, Reset,
    // Change password, admin user forms) since they all go through this
    // one primitive — matters most on mobile, where there's no separate
    // "show password" affordance the OS provides for you.
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-ink-secondary text-[12.5px] font-semibold">
            {label}
            {required && <span className="text-status-critical ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (revealed ? 'text' : 'password') : type}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={cn(errorId, helperId) || undefined}
            className={cn(
              // w-full is load-bearing: wrapping the input in the `relative`
              // div below for the password toggle took it out of being a
              // direct flex child of the flex-col field wrapper, which is
              // what previously stretched it to full width for free. Without
              // this it shrinks to its intrinsic size, leaving the toggle
              // button anchored to the (still full-width) wrapper and
              // floating off past the visibly-narrower input box.
              'border-[1.5px] border-ink/15 bg-surface-2 text-ink w-full appearance-none rounded-lg px-3.5 py-2.5 text-sm outline-none transition',
              // Native form controls can pick up the OS/browser's own dark-mode
              // widget theme (driven by the page's color-scheme) and ignore an
              // author background-color unless appearance is reset — without
              // this, dark mode showed a white box here despite the right class.
              'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/30',
              'disabled:opacity-50 disabled:pointer-events-none',
              isPassword && 'pr-10',
              error && 'border-status-critical focus-visible:border-status-critical focus-visible:outline-status-critical/30',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="text-ink-muted hover:text-ink absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2"
            >
              {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
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
