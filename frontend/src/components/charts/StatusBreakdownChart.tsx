import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartCard } from './ChartCard';
import { Status } from '../../types/domain';

const COLORS: Record<string, string> = {
  [Status.NEW]: 'var(--color-ink-muted)',
  [Status.ACKNOWLEDGED]: 'var(--color-status-warning)',
  [Status.IN_PROGRESS]: 'var(--color-status-serious)',
  [Status.RESOLVED]: 'var(--color-status-good)',
  [Status.CLOSED]: 'var(--color-ink-muted)',
  [Status.CANCELLED]: 'var(--color-ink-muted)',
  [Status.FALSE_ALARM]: 'var(--color-ink-muted)',
};

function labelFor(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBreakdownChart({
  data,
  isLoading,
  isError,
}: {
  data?: { status: Status; count: number }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const total = (data ?? []).reduce((sum, d) => sum + d.count, 0);
  const points = (data ?? []).filter((d) => d.count > 0).map((d) => ({ name: labelFor(d.status), value: d.count, key: d.status }));

  return (
    <ChartCard
      title="Reports by status"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && total === 0}
    >
      <div
        className="h-52 w-full"
        role="img"
        aria-label={`Donut chart of ${total} reports by status: ${points.map((p) => `${p.name} ${p.value}`).join(', ')}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={points} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
              {points.map((p) => (
                <Cell key={p.key} fill={COLORS[p.key] ?? 'var(--color-ink-muted)'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-2)',
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => <span style={{ color: 'var(--color-ink-secondary)', fontSize: 12 }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
