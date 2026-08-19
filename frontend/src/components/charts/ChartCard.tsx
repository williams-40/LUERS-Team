import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

export function ChartCard({
  title,
  subtitle,
  actions,
  isLoading,
  isError,
  isEmpty,
  emptyMessage = 'Nothing to show for this period yet.',
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-ink-secondary text-[12.5px] font-semibold">{title}</h3>
          {subtitle && <p className="text-ink-muted mt-0.5 text-[11px]">{subtitle}</p>}
        </div>
        {actions}
      </div>

      {isLoading && <Skeleton className="h-52 w-full" />}
      {!isLoading && isError && (
        <ErrorState description={`Couldn't load this chart.`} className="bg-transparent p-4" />
      )}
      {!isLoading && !isError && isEmpty && (
        <EmptyState title="No data yet" description={emptyMessage} className="p-4" />
      )}
      {!isLoading && !isError && !isEmpty && children}
    </Card>
  );
}
