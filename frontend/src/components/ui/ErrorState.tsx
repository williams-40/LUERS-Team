import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function ErrorState({
  title = "Couldn't load this",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'bg-status-critical/8 flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center',
        className,
      )}
    >
      <p className="text-status-critical font-heading font-semibold">{title}</p>
      {description && <p className="text-status-critical/80 max-w-xs text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
