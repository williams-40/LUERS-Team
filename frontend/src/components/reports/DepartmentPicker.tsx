import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '../../lib/departments-api';
import { cn } from '../../lib/utils';
import { handleRadiogroupKeyDown, radioTabIndex } from '../../lib/roving-radiogroup';

export function DepartmentPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (departmentId: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['departments', { is_active: true, picker: true }],
    queryFn: () => fetchDepartments({ is_active: true }),
  });

  if (isLoading) {
    return <p className="text-ink-muted text-sm">Loading departments…</p>;
  }
  if (isError || !data) {
    return <p className="text-status-critical text-sm">Couldn't load departments. Please try again.</p>;
  }

  const anyActive = data.results.some((d) => d.id === value);

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Department" onKeyDown={handleRadiogroupKeyDown}>
      {data.results.map((department, index) => {
        const active = value === department.id;
        return (
          <button
            key={department.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={radioTabIndex(active, index === 0, anyActive)}
            onClick={() => onChange(department.id)}
            className={cn(
              'rounded-full border-[1.5px] px-3.5 py-2 text-sm font-semibold transition',
              active
                ? 'bg-brand border-brand text-white'
                : 'text-ink-secondary border-ink/15 hover:border-ink/30',
            )}
          >
            {department.name}
          </button>
        );
      })}
    </div>
  );
}
