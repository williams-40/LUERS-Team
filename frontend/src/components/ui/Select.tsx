import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, id, required, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-ink-secondary text-[12.5px] font-semibold">
            {label}
            {required && <span className="text-status-critical ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={cn(errorId, helperId) || undefined}
            className={cn(
              'border-[1.5px] border-ink/15 bg-surface-2 text-ink w-full appearance-none rounded-lg py-2.5 pr-9 pl-3.5 text-sm outline-none transition',
              // Same native-widget-theming issue as Input/Textarea — appearance
              // reset is required for the custom chevron below to be the only
              // one shown, and for the background to actually apply in dark mode.
              'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/30',
              'disabled:opacity-50 disabled:pointer-events-none',
              error && 'border-status-critical focus-visible:border-status-critical focus-visible:outline-status-critical/30',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="text-ink-muted pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
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
Select.displayName = 'Select';
