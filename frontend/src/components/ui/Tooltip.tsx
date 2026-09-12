import { type ReactNode, useId, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Hover/focus tooltip for icon-only controls (collapsed sidebar items,
 * icon-only buttons) — labeled via aria-describedby so the accessible name
 * still comes from the trigger's own aria-label, and this only adds the
 * visible-on-hover hint text.
 */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'bg-ink text-surface pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap opacity-0 transition-opacity',
          visible && 'opacity-100',
        )}
      >
        {label}
      </span>
    </span>
  );
}
