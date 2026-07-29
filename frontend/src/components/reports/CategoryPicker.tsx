import { Category } from '../../types/domain';
import { CATEGORY_LABELS } from '../../lib/labels';
import { cn } from '../../lib/utils';

const CATEGORY_OPTIONS = Object.values(Category);

export function CategoryPicker({
  value,
  onChange,
}: {
  value: Category | undefined;
  onChange: (category: Category) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
      {CATEGORY_OPTIONS.map((category) => {
        const active = value === category;
        return (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(category)}
            className={cn(
              'rounded-full border-[1.5px] px-3.5 py-2 text-sm font-semibold transition',
              active
                ? 'bg-brand border-brand text-white'
                : 'text-ink-secondary border-black/15 hover:border-black/30',
            )}
          >
            {CATEGORY_LABELS[category]}
          </button>
        );
      })}
    </div>
  );
}
