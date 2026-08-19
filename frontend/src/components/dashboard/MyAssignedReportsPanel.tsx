import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { fetchReportQueue } from '../../lib/reports-api';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Status } from '../../types/domain';

const OPEN_STATUSES = new Set<Status>([Status.NEW, Status.ACKNOWLEDGED, Status.IN_PROGRESS]);
const PREVIEW_LIMIT = 5;

/**
 * Phase 7: the dashboard view for a plain responder — has
 * view_admin_dashboard (so they can reach /admin, where they actually
 * work reports) but heads no department. DashboardTrendsPanel/
 * DashboardAnalyticsPanel are built for a manager persona (monthly
 * trends, responder-workload/performance comparisons); computed over
 * get_accessible_reports, that's just this one person's handful of
 * assigned reports for a non-head, so those panels degenerate into "a
 * chart about yourself" rather than being useful. This shows their open
 * assigned reports directly instead, with a link to the full queue.
 *
 * 2026-08-17: now the responder's PRIMARY view rather than an admin's
 * secondary preview, so it filters explicitly server-side
 * (assigned_to=me, filter_reports) instead of relying on
 * get_accessible_reports already happening to narrow a responder to
 * their own assignments — that was correct in effect but coincidental,
 * and paginated over the wrong axis (page 1 of everything, not page 1 of
 * "mine").
 */
export function MyAssignedReportsPanel() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'queue', 'dashboard-preview', user?.id],
    queryFn: () => fetchReportQueue({ assigned_to: user!.id }),
    enabled: Boolean(user),
  });

  const openReports = (data?.page.results ?? [])
    .filter((r) => OPEN_STATUSES.has(r.status))
    .slice(0, PREVIEW_LIMIT);

  return (
    <div className="mb-6 rounded-xl border border-ink/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ink-secondary flex items-center gap-1.5 text-[12.5px] font-semibold">
          <ClipboardList className="h-4 w-4" aria-hidden />
          My assigned reports
        </h2>
        <Link to="/admin">
          <Button type="button" variant="ghost" size="sm">
            View queue
          </Button>
        </Link>
      </div>

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}
      {isError && <ErrorState description="Couldn't load your reports." className="bg-transparent p-0" />}

      {data && openReports.length === 0 && (
        <EmptyState
          title="Nothing assigned"
          description="No open reports assigned to you right now."
          className="items-start p-0 text-left"
        />
      )}

      {openReports.length > 0 && (
        <ul className="flex flex-col gap-2">
          {openReports.map((report) => (
            <li key={report.id}>
              <Link
                to={`/reports/${report.id}`}
                className="hover:bg-ink/4 flex items-center justify-between gap-3 rounded-lg border border-ink/10 px-3 py-2 text-sm"
              >
                <span className="truncate">{report.description}</span>
                <StatusBadge status={report.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
