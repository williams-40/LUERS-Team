import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/**
 * Used sparingly — only on report detail and admin sub-forms, not globally
 * on every page (see the redesign plan's navigation section for why).
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12.5px]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="text-ink-muted h-3 w-3" aria-hidden />}
            {item.to && !isLast ? (
              <Link to={item.to} className="text-ink-secondary hover:text-brand">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-ink font-medium' : 'text-ink-secondary'} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
