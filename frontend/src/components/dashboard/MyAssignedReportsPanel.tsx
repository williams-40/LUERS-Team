import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchReportQueue } from '../../lib/reports-api';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
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
 * Reads the default (unfiltered, page 1) report list rather than adding
 * a new backend filter for this — good enough for a "quick glance"
 * widget whose entire purpose is to hand off to the real queue for
 * anything beyond the first page.
 */
export function MyAssignedReportsPanel() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'queue', 'dashboard-preview'],
    queryFn: () => fetchReportQueue({}),
  });

  const openReports = (data?.page.results ?? [])
    .filter((r) => r.assigned_to === user?.id && OPEN_STATUSES.has(r.status))
    .slice(0, PREVIEW_LIMIT);

  return (
    <div className="mb-6 rounded-xl border border-ink/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ink-secondary text-[12.5px] font-semibold">My assigned reports</h2>
        <Link to="/admin">
          <Button type="button" variant="ghost" size="sm">
            View queue
          </Button>
        </Link>
      </div>

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}
      {isError && <p className="text-status-critical text-sm">Couldn't load your reports.</p>}

      {data && openReports.length === 0 && (
        <p className="text-ink-muted text-sm">No open reports assigned to you right now.</p>
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
