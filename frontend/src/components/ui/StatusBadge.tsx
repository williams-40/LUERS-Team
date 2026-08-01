import { Status } from '../../types/domain';
import { cn } from '../../lib/utils';

/**
 * Workflow-status badge — a separate scale from the severity rail's urgency
 * color on purpose (see ReportCard). "New" stays neutral rather than
 * borrowing red: being unactioned isn't inherently bad, so it shouldn't
 * compete visually with a genuinely urgent (panic) report.
 */
const STATUS_STYLES: Record<Status, { label: string; dot: string; classes: string }> = {
  [Status.NEW]: {
    label: 'New',
    dot: 'bg-ink-muted',
    classes: 'bg-ink-muted/18 text-ink-secondary',
  },
  [Status.ACKNOWLEDGED]: {
    label: 'Acknowledged',
    dot: 'bg-status-warning',
    classes: 'bg-status-warning/20 text-status-warning-ink',
  },
  [Status.IN_PROGRESS]: {
    label: 'In progress',
    dot: 'bg-status-serious',
    classes: 'bg-status-serious/18 text-status-serious-ink',
  },
  [Status.RESOLVED]: {
    label: 'Resolved',
    dot: 'bg-status-good',
    classes: 'bg-status-good/16 text-status-good-ink',
  },
  [Status.CLOSED]: {
    label: 'Closed',
    dot: 'bg-ink-muted',
    classes: 'bg-ink-muted/14 text-ink-muted',
  },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        style.classes,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}
