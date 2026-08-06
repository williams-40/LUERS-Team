import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '../../lib/departments-api';

/** Multi-select checkbox variant of DepartmentPicker, for flows that can target more than one department (e.g. Request Assistance). */
export function DepartmentMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['departments', { is_active: true, picker: true }],
    queryFn: () => fetchDepartments({ is_active: true }),
  });

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  if (isLoading) {
    return <p className="text-ink-muted text-sm">Loading departments…</p>;
  }
  if (isError || !data) {
    return <p className="text-status-critical text-sm">Couldn't load departments. Please try again.</p>;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-ink/15 p-3">
      {data.results.map((department) => (
        <label key={department.id} className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-brand h-4 w-4"
            checked={value.includes(department.id)}
            onChange={() => toggle(department.id)}
          />
          <span className="text-sm">{department.name}</span>
        </label>
      ))}
    </div>
  );
}
