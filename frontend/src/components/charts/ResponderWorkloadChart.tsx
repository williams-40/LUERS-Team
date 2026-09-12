import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from './ChartCard';

export function ResponderWorkloadChart({
  data,
  isLoading,
  isError,
}: {
  data?: { responder_id: string; username: string; open_count: number }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const points = (data ?? []).map((w) => ({ name: w.username, value: w.open_count })).sort((a, b) => b.value - a.value);

  return (
    <ChartCard
      title="Responder workload"
      subtitle="Currently open reports per responder"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && points.length === 0}
      emptyMessage="No responder currently has an open report."
    >
      <div
        style={{ height: Math.max(140, points.length * 32) }}
        className="w-full"
        role="img"
        aria-label={`Bar chart of open reports per responder: ${points.map((p) => `${p.name} ${p.value}`).join(', ') || 'none'}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink)" strokeOpacity={0.08} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-ink-secondary)' }} axisLine={false} tickLine={false} width={90} />
            <Tooltip
              cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.04 }}
              contentStyle={{
                background: 'var(--color-surface-2)',
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)',
              }}
            />
            <Bar dataKey="value" fill="var(--color-status-serious)" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
