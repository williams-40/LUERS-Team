import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Only rendered where a comparison is safely calculable from real data
 * (e.g. the last two entries of analytics.monthly_trend, or two lookback
 * windows of dashboard/trends) — never a fabricated percentage. Direction
 * is shown neutrally (no green-up/red-down assumption) since "up" isn't
 * consistently good (e.g. more open reports is bad, more resolved is good).
 */
export function TrendIndicator({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) {
    return (
      <p className="text-ink-muted text-[12.5px]">
        {current > 0 ? `+${current}` : '0'} {label}
      </p>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <p className={cn('text-ink-secondary flex items-center gap-1 text-[12.5px]')}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="font-semibold">
        {change > 0 ? '+' : ''}
        {change.toFixed(1)}%
      </span>
      {label}
    </p>
  );
}
