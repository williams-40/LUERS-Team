import { useQuery } from '@tanstack/react-query';
import { fetchRoles } from '../../lib/roles-api';

export function RoleSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (role: string) => void;
}) {
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles', { is_active: true, picker: true }],
    queryFn: () => fetchRoles({ is_active: true }),
  });

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
    >
      <option value="" disabled>
        {isLoading ? 'Loading roles…' : 'Select a role'}
      </option>
      {(roles ?? []).map((role) => (
        <option key={role.slug} value={role.slug}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
