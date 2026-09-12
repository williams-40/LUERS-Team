import { Skeleton } from '../ui/Skeleton';

/** Matches ReportCard's layout (severity rail, category/status row, 2-line
 * description, metadata row) so loading doesn't visually jump once content arrives. */
export function ReportCardSkeleton() {
  return (
    <div className="bg-surface-2 relative flex gap-3.5 overflow-hidden rounded-xl border border-ink/10 py-3.5 pr-4 pl-[18px]">
      <span className="bg-ink-muted/15 absolute inset-y-0 left-0 w-[5px]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="mb-1.5 h-3.5 w-full" />
        <Skeleton className="mb-2 h-3.5 w-2/3" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}
