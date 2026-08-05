import { useQuery } from '@tanstack/react-query';
import { fetchDashboardAnalytics } from '../../lib/dashboard-api';

export function DashboardAnalyticsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: fetchDashboardAnalytics,
  });

  if (isLoading) return null;
  if (isError || !data) {
    return <p className="text-status-critical text-sm">Couldn't load analytics.</p>;
  }

  const maxMonthly = Math.max(1, ...data.monthly_trend.map((m) => m.count));

  return (
    <div className="mb-6 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Operational analytics</h2>

      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <span className="text-ink-muted block text-[11px] font-semibold uppercase">Open</span>
          <span className="text-xl font-bold">{data.open}</span>
        </div>
        <div>
          <span className="text-ink-muted block text-[11px] font-semibold uppercase">In progress</span>
          <span className="text-xl font-bold">{data.in_progress}</span>
        </div>
        <div>
          <span className="text-ink-muted block text-[11px] font-semibold uppercase">Resolved</span>
          <span className="text-xl font-bold">{data.resolved}</span>
        </div>
        <div>
          <span className="text-ink-muted block text-[11px] font-semibold uppercase">Closed</span>
          <span className="text-xl font-bold">{data.closed}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <p>
          <span className="font-semibold">Avg. assignment time:</span>{' '}
          {data.average_assignment_time_hours !== null ? `${data.average_assignment_time_hours.toFixed(1)} hrs` : '—'}
        </p>
        <p>
          <span className="font-semibold">Avg. resolution time:</span>{' '}
          {data.average_resolution_time_hours !== null ? `${data.average_resolution_time_hours.toFixed(1)} hrs` : '—'}
        </p>
        <p className={data.overdue > 0 ? 'text-status-critical font-semibold' : ''}>
          <span className="font-semibold">Overdue:</span> {data.overdue}
        </p>
      </div>

      <div className="mb-4">
        <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">By urgency</h3>
        <ul className="flex flex-col gap-0.5 text-sm">
          {data.urgency_counts.map((u) => (
            <li key={u.urgency} className="flex justify-between">
              <span className="capitalize">{u.urgency}</span>
              <span className="font-semibold">{u.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {data.monthly_trend.length > 0 && (
        <div className="mb-4">
          <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">Monthly trend</h3>
          <div className="flex h-16 items-end gap-1">
            {data.monthly_trend.map((m) => (
              <div key={m.month} className="group relative flex flex-1 flex-col items-center justify-end">
                <div
                  className="bg-brand w-full rounded-t-sm transition-opacity group-hover:opacity-80"
                  style={{ height: `${(m.count / maxMonthly) * 100}%`, minHeight: m.count > 0 ? '2px' : '0' }}
                />
                <div className="pointer-events-none absolute -top-6 hidden rounded bg-black/80 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
                  {m.month}: {m.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.responder_workload.length > 0 && (
        <div className="mb-4">
          <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">Responder workload</h3>
          <ul className="flex flex-col gap-0.5 text-sm">
            {data.responder_workload.map((w) => (
              <li key={w.responder_id} className="flex justify-between">
                <span>{w.username}</span>
                <span className="font-semibold">{w.open_count} open</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.responder_performance.length > 0 && (
        <div className="mb-4">
          <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">Responder performance</h3>
          <ul className="flex flex-col gap-0.5 text-sm">
            {data.responder_performance.map((p) => (
              <li key={p.responder_id} className="flex justify-between">
                <span>{p.username}</span>
                <span className="font-semibold">
                  {p.resolved_count} resolved
                  {p.average_resolution_time_hours !== null ? ` · ${p.average_resolution_time_hours.toFixed(1)} hrs avg` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.top_keywords.length > 0 && (
        <div>
          <h3 className="text-ink-muted mb-1 text-[11px] font-semibold uppercase">Common keywords</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.top_keywords.map((k) => (
              <span key={k.keyword} className="bg-ink/5 rounded-full px-2 py-0.5 text-xs">
                {k.keyword} <span className="text-ink-muted">({k.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
