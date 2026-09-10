import { Link } from 'react-router-dom';
import { Status } from '../types/domain';
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
 * The severity rail used to read urgency (pulsing red for panic vs. static
 * blue for normal), but every report is panic now — that signal stopped
 * distinguishing anything. What still varies, and still matters at a
 * glance, is whether this needs a first response: pulsing red until
 * acknowledged, settling to amber while being worked, muted once it's
 * over one way or another.
 */
const SEVERITY_RAIL: Record<Status, { rail: string; pulse: boolean }> = {
  [Status.NEW]: { rail: 'bg-status-critical', pulse: true },
  [Status.ACKNOWLEDGED]: { rail: 'bg-status-warning', pulse: false },
  [Status.IN_PROGRESS]: { rail: 'bg-status-warning', pulse: false },
  [Status.RESOLVED]: { rail: 'bg-ink-muted', pulse: false },
  [Status.CLOSED]: { rail: 'bg-ink-muted', pulse: false },
  [Status.CANCELLED]: { rail: 'bg-ink-muted', pulse: false },
  [Status.FALSE_ALARM]: { rail: 'bg-ink-muted', pulse: false },
};

export function ReportCard({ report }: { report: ReportListItem }) {
  const severity = SEVERITY_RAIL[report.status];
  // The legacy category_display field has been null on every report since
  // the department-routing rework — emergency_type_display (this report's
  // category label) and department_name are what's actually populated now.
  const title = report.emergency_dispatch?.emergency_type_display || report.department_name || report.category_display || 'Report';

  return (
    <Link
      to={`/reports/${report.id}`}
      className={cn(
        'bg-surface-2 relative flex gap-3.5 overflow-hidden rounded-xl border border-ink/10 py-3.5 pr-4 pl-[18px]',
        'transition hover:border-ink/20',
        severity.pulse && 'animate-[rail-pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-[5px]', severity.rail)} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{title}</span>
          <StatusBadge status={report.status} />
        </div>

        <p className="text-ink-secondary mb-2 line-clamp-2 text-[13.5px] leading-relaxed">
          {report.description || 'No description provided.'}
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
          {report.assigned_to_username && (
            <>
              <span>·</span>
              <span>@{report.assigned_to_username}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
