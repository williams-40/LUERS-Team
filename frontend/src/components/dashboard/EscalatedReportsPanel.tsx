import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchReportQueue } from '../../lib/reports-api';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';

const PREVIEW_LIMIT = 5;

/**
 * System Admin-only: a department head escalating a report (see
 * EmergencyActionsControl's "Escalate to System Admin") otherwise only
 * reaches admin as an SMS/email — this is the in-app place to actually see
 * and act on those. Scoped server-side to reports with a manual
 * (actor-set) EMERGENCY_ESCALATED audit entry that are still active, so it
 * naturally empties out once each one is resolved/cancelled.
 */
export function EscalatedReportsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'queue', 'dashboard-escalated'],
    queryFn: () => fetchReportQueue({ escalated_to_admin: true, active: true }),
  });

  const reports = (data?.page.results ?? []).slice(0, PREVIEW_LIMIT);
  const total = data?.page.count ?? 0;

  return (
    <div className="border-status-critical/30 bg-status-critical/5 mb-6 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-status-critical text-[12.5px] font-semibold">
          Escalated to you{total > 0 ? ` (${total})` : ''}
        </h2>
        <Link to="/admin/escalated">
          <Button type="button" variant="ghost" size="sm">
            View all
          </Button>
        </Link>
      </div>

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}
      {isError && <p className="text-status-critical text-sm">Couldn't load escalated reports.</p>}

      {data && reports.length === 0 && (
        <p className="text-ink-muted text-sm">Nothing currently escalated to you.</p>
      )}

      {reports.length > 0 && (
        <ul className="flex flex-col gap-2">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                to={`/reports/${report.id}`}
                className="hover:bg-ink/4 flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-surface px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {report.description || report.emergency_dispatch?.emergency_type_display || report.category_display || 'Report'}
                </span>
                <StatusBadge status={report.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
