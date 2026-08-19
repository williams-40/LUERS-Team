import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <p className="text-ink font-heading font-semibold">{title}</p>
      {description && <p className="text-ink-secondary max-w-xs text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
