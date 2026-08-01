import { useQuery } from '@tanstack/react-query';
import { fetchDashboardTrends } from '../../lib/dashboard-api';

const TREND_DAYS = 14;

export function DashboardTrendsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'trends', TREND_DAYS],
    queryFn: () => fetchDashboardTrends(TREND_DAYS),
  });

  if (isLoading) return null;
  if (isError || !data) {
    return <p className="text-status-critical text-sm">Couldn't load the trend chart.</p>;
  }

  const max = Math.max(1, ...data.daily_counts.map((d) => d.count));

  return (
    <div className="mb-6 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">
        Reports per day (last {TREND_DAYS} days)
      </h2>
      <div className="flex h-24 items-end gap-1">
        {data.daily_counts.map((day) => (
          <div key={day.date} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className="bg-brand w-full rounded-t-sm transition-opacity group-hover:opacity-80"
              style={{ height: `${(day.count / max) * 100}%`, minHeight: day.count > 0 ? '2px' : '0' }}
            />
            <div className="pointer-events-none absolute -top-6 hidden rounded bg-black/80 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
              {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}:{' '}
              {day.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
