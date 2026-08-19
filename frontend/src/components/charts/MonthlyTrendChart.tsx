import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from './ChartCard';
import { TrendIndicator } from '../dashboard/TrendIndicator';

function labelFor(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export function MonthlyTrendChart({
  data,
  isLoading,
  isError,
}: {
  data?: { month: string; count: number }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const points = (data ?? []).map((m) => ({ ...m, label: labelFor(m.month) }));
  const [previous, current] = points.slice(-2);

  return (
    <ChartCard
      title="Monthly trend"
      subtitle="Last 12 months"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && points.length === 0}
      actions={
        current && previous ? <TrendIndicator current={current.count} previous={previous.count} label="vs prior month" /> : undefined
      }
    >
      <div
        className="h-44 w-full"
        role="img"
        aria-label={`Bar chart of reports per month over the last ${points.length} months.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink)" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.04 }}
              contentStyle={{
                background: 'var(--color-surface-2)',
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)',
              }}
            />
            <Bar dataKey="count" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
