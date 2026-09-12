import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchDashboardTrends } from '../../lib/dashboard-api';
import { ChartCard } from './ChartCard';
import { cn } from '../../lib/utils';

const WINDOWS = [7, 14, 30, 90] as const;

/**
 * The only backend-supported timeframe shape is a lookback window
 * (?days=N, N<=180) — not a from/to range — so the selector offers windows
 * rather than a date-range picker (see the redesign plan's "challenges"
 * section for why a real range picker isn't built yet).
 */
export function ReportsTrendChart() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'trends', days],
    queryFn: () => fetchDashboardTrends(days),
  });

  const points = (data?.daily_counts ?? []).map((d) => ({ ...d, label: format(parseISO(d.date), 'MMM d') }));
  const total = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <ChartCard
      title="Reports trend"
      subtitle={`${total} report${total === 1 ? '' : 's'} in the last ${days} days`}
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && total === 0}
      emptyMessage="No reports were created in this window."
      actions={
        <div role="group" aria-label="Timeframe" className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={days === w}
              onClick={() => setDays(w)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-semibold transition',
                days === w ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-ink/6',
              )}
            >
              {w}d
            </button>
          ))}
        </div>
      }
    >
      <div
        className="h-52 w-full"
        role="img"
        aria-label={`Line chart of reports per day over the last ${days} days, totaling ${total}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="reportsTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink)" strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-ink)',
                borderColor: 'color-mix(in srgb, var(--color-ink) 10%, transparent)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
              formatter={(value) => [value, 'Reports']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--color-brand)"
              strokeWidth={2}
              fill="url(#reportsTrendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
