import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card } from '../ui/Card';

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Presentational shell around a set of filter controls — the controls
 * themselves (their state, their options) stay owned by the page that
 * renders them; this only supplies the compact bar layout plus an
 * active-filter chip row so it's obvious at a glance what's currently
 * narrowing the list, with a one-click way to clear each one.
 */
export function FilterBar({
  children,
  chips = [],
  onClearAll,
}: {
  children: ReactNode;
  chips?: FilterChip[];
  onClearAll?: () => void;
}) {
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-end gap-3">{children}</div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink/10 pt-3">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="bg-brand/10 text-brand flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium hover:brightness-95"
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          {onClearAll && (
            <button type="button" onClick={onClearAll} className="text-ink-muted ml-1 text-[12px] underline">
              Clear all
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
