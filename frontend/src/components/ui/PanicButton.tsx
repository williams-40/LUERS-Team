import { type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * The one-tap emergency action. Deliberately breaks from the standard Button
 * system — full width, heavier weight, critical-red — so it never gets
 * confused with an ordinary "primary" action elsewhere in the app.
 */
export function PanicButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'bg-status-critical flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-5',
        'font-heading text-[17px] font-extrabold tracking-[0.01em] text-white',
        'shadow-[0_8px_24px_rgba(208,59,59,0.35)] active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        className,
      )}
      {...props}
    >
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
      {children ?? 'Report Emergency Now'}
    </button>
  );
}
