import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from './ChartCard';

export function DepartmentBreakdownChart({
  data,
  isLoading,
  isError,
}: {
  data?: { department_name: string | null; count: number }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const points = (data ?? [])
    .map((d) => ({ name: d.department_name ?? 'Unassigned', value: d.count }))
    .sort((a, b) => b.value - a.value);
  const total = points.reduce((sum, p) => sum + p.value, 0);

  return (
    <ChartCard
      title="Reports by department"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && total === 0}
    >
      <div
        style={{ height: Math.max(160, points.length * 32) }}
        className="w-full"
        role="img"
        aria-label={`Bar chart of reports by department: ${points.map((p) => `${p.name} ${p.value}`).join(', ')}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink)" strokeOpacity={0.08} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-ink-secondary)' }} axisLine={false} tickLine={false} width={110} />
            <Tooltip
              cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.04 }}
              contentStyle={{
                background: 'var(--color-surface-2)',
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)',
              }}
            />
            <Bar dataKey="value" fill="var(--color-brand)" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
