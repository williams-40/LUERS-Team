import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from './ChartCard';
import { Urgency } from '../../types/domain';

const COLORS: Record<string, string> = {
  [Urgency.PANIC]: 'var(--color-status-critical)',
  [Urgency.NORMAL]: 'var(--color-brand)',
};

export function UrgencyBreakdownChart({
  data,
  isLoading,
  isError,
}: {
  data?: { urgency: Urgency; count: number }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const total = (data ?? []).reduce((sum, d) => sum + d.count, 0);
  const points = (data ?? []).map((d) => ({ name: d.urgency === Urgency.PANIC ? 'Panic' : 'Normal', value: d.count, key: d.urgency }));

  return (
    <ChartCard title="Reports by urgency" isLoading={isLoading} isError={isError} isEmpty={!isLoading && !isError && total === 0}>
      <div
        className="h-40 w-full"
        role="img"
        aria-label={`Bar chart of reports by urgency: ${points.map((p) => `${p.name} ${p.value}`).join(', ')}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink)" strokeOpacity={0.08} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-ink-secondary)' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.04 }}
              contentStyle={{
                background: 'var(--color-surface-2)',
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
              {points.map((p) => (
                <Cell key={p.key} fill={COLORS[p.key] ?? 'var(--color-brand)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
