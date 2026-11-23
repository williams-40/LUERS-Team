import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Formalizes the `rounded-xl border border-ink/10 p-4` card shell that was
 * previously copy-pasted across ~10 dashboard/report components.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-2 rounded-xl border border-ink/10 p-4', className)}
      {...props}
    />
  );
}
