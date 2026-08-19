import { type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, required, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText ? `${textareaId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-ink-secondary text-[12.5px] font-semibold">
            {label}
            {required && <span className="text-status-critical ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(errorId, helperId) || undefined}
          className={cn(
            'border-[1.5px] border-ink/15 bg-surface-2 text-ink appearance-none rounded-lg px-3.5 py-2.5 text-sm outline-none transition',
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
Textarea.displayName = 'Textarea';
