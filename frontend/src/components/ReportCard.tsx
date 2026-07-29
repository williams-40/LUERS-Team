import { Link } from 'react-router-dom';
import { Urgency } from '../types/domain';
import type { ReportListItem } from '../types/domain';
import { StatusBadge } from './ui/StatusBadge';
import { cn } from '../lib/utils';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * The severity rail: urgency, not workflow status, is the one signal a
 * triage officer should read without looking at anything else on the card.
 * It never changes for status — a resolved panic report should still show
 * it *was* urgent when scanning history.
 */
export function ReportCard({ report }: { report: ReportListItem }) {
  const isPanic = report.urgency === Urgency.PANIC;

  return (
    <Link
      to={`/reports/${report.id}`}
      className={cn(
        'bg-surface-2 relative flex gap-3.5 overflow-hidden rounded-xl border border-black/10 py-3.5 pr-4 pl-[18px]',
        'transition hover:border-black/20',
        isPanic && 'animate-[rail-pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none',
      )}
    >
      <span
        className={cn('absolute inset-y-0 left-0 w-[5px]', isPanic ? 'bg-status-critical' : 'bg-brand')}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{report.category_display}</span>
          <StatusBadge status={report.status} />
        </div>

        <p className="text-ink-secondary mb-2 line-clamp-2 text-[13.5px] leading-relaxed">
          {report.is_anonymous && <span className="text-brand mr-1 font-semibold">Anonymous reporter ·</span>}
          {report.description}
        </p>

        <div className="text-ink-muted flex items-center gap-2.5 font-mono text-[11px]">
          <span>{report.id.slice(0, 8).toUpperCase()}</span>
          <span>·</span>
          <span>{timeAgo(report.updated_at)}</span>
          {report.evidence_count > 0 && (
            <>
              <span>·</span>
              <span>
                {report.evidence_count} file{report.evidence_count === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
