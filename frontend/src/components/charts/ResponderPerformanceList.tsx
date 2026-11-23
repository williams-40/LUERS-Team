import { ChartCard } from './ChartCard';

export function ResponderPerformanceList({
  data,
  isLoading,
  isError,
}: {
  data?: { responder_id: string; username: string; resolved_count: number; average_resolution_time_hours: number | null }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const rows = [...(data ?? [])].sort((a, b) => b.resolved_count - a.resolved_count);

  return (
    <ChartCard
      title="Responder performance"
      subtitle="Resolved reports and average time to resolve"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && rows.length === 0}
    >
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.responder_id} className="flex items-center justify-between text-sm">
            <span className="truncate">{r.username}</span>
            <span className="text-ink-secondary shrink-0 tabular-nums">
              <span className="font-semibold">{r.resolved_count}</span> resolved
              {r.average_resolution_time_hours !== null && ` · ${r.average_resolution_time_hours.toFixed(1)} hrs avg`}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
