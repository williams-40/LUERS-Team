import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchEmergencyCategories } from '../lib/emergency-categories-api';
import { Button } from '../components/ui/Button';
import type { EmergencyCategory } from '../types/domain';

function EmergencyCategoryRow({ category }: { category: EmergencyCategory }) {
  return (
    <Link
      to={`/admin/emergency-categories/${category.id}/edit`}
      className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3 transition hover:border-ink/20"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{category.name}</span>
          {!category.is_active && (
            <span className="bg-ink-muted/18 text-ink-secondary rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Inactive
            </span>
          )}
          {category.requires_description_and_routing && (
            <span className="bg-brand/12 text-brand rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Auto-routed
            </span>
          )}
        </div>
        <p className="text-ink-secondary truncate text-[12.5px]">
          {category.department_name ? `Routes to: ${category.department_name}` : 'No default department'} ·{' '}
          <span className="font-mono">{category.slug}</span>
        </p>
      </div>
    </Link>
  );
}

export function EmergencyCategoriesPage() {
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['emergency-categories', isActive, page],
    queryFn: () => fetchEmergencyCategories({ is_active: isActive, page }),
  });

  function setActiveFilter(value: string): void {
    setIsActive(value === '' ? undefined : value === 'true');
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Emergency categories</h1>
        <Link to="/admin/emergency-categories/new">
          <Button variant="primary" size="sm">
            New category
          </Button>
        </Link>
      </div>
      <p className="text-ink-secondary mb-6 text-sm">
        These are the categories reporters choose from on the emergency report form.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Status</span>
          <select
            value={isActive === undefined ? '' : String(isActive)}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="bg-surface-2 text-ink select-chevron appearance-none rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {isError && (
        <p className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          Couldn't load emergency categories. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">No categories match these filters.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((category) => (
            <EmergencyCategoryRow key={category.id} category={category} />
          ))}
        </div>
      )}

      {data && (data.next || data.previous) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-ink-muted text-xs">Page {page}</span>
          <Button variant="ghost" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
