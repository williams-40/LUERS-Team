import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDashboardSummary } from '../../lib/dashboard-api';
import { useReportSocket } from '../../hooks/useReportSocket';
import { LiveIndicator } from '../ui/LiveIndicator';
import { CATEGORY_LABELS } from '../../lib/labels';

const SUMMARY_KEY = ['dashboard', 'summary'];
const REFRESH_DEBOUNCE_MS = 400;

/**
 * Live counts refetch (debounced) rather than patch aggregate counts
 * client-side — a report_updated event carries the report's new state but
 * not its previous one, so there's no reliable way to shift it out of its
 * old status/category bucket without re-deriving from the server anyway.
 */
export function DashboardSummaryPanel() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: fetchDashboardSummary,
  });

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    }, REFRESH_DEBOUNCE_MS);
  }, [queryClient]);

  const { status: socketStatus, reconnect } = useReportSocket({
    onReportCreated: scheduleRefresh,
    onReportUpdated: scheduleRefresh,
  });

  return (
    <div className="mb-6 rounded-xl border border-black/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ink-secondary text-[12.5px] font-semibold">Campus summary</h2>
        <LiveIndicator status={socketStatus} onReconnect={reconnect} />
      </div>

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}
      {isError && <p className="text-status-critical text-sm">Couldn't load the summary.</p>}

      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{data.total}</span>
            <span className="text-ink-muted text-sm">total reports</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">By status</h3>
              <ul className="flex flex-col gap-0.5">
                {data.status_counts.map((s) => (
                  <li key={s.status} className="flex justify-between">
                    <span className="capitalize">{s.status.replace('_', ' ')}</span>
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">By urgency</h3>
              <ul className="flex flex-col gap-0.5">
                {data.urgency_counts.map((u) => (
                  <li key={u.urgency} className="flex justify-between">
                    <span className="capitalize">{u.urgency}</span>
                    <span className="font-semibold">{u.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-2">
              <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">By category</h3>
              <ul className="flex flex-col gap-0.5">
                {data.category_counts.map((c) => (
                  <li key={c.category} className="flex justify-between">
                    <span>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                    <span className="font-semibold">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {data.average_response_time_hours !== null && (
            <p className="text-ink-secondary text-sm">
              <span className="font-semibold">Avg. resolution time:</span>{' '}
              {data.average_response_time_hours.toFixed(1)} hrs
            </p>
          )}
        </div>
      )}
    </div>
  );
}
