import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

export function KPIStatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: ReactNode;
  /** Semantic tint for the value itself — kept separate from the brand accent, only used where it's actually meaningful (e.g. an overdue count). */
  tone?: 'neutral' | 'warning' | 'critical' | 'good';
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-muted text-[11px] font-semibold tracking-wide uppercase">{label}</span>
        {Icon && <Icon className="text-ink-muted h-4 w-4" aria-hidden />}
      </div>
      <span
        className={cn(
          'font-heading text-[26px] leading-none font-bold tabular-nums',
          tone === 'warning' && 'text-status-warning-ink',
          tone === 'critical' && 'text-status-critical',
          tone === 'good' && 'text-status-good-ink',
        )}
      >
        {value}
      </span>
      {trend}
    </Card>
  );
}
