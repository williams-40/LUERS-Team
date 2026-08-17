import { useQuery } from '@tanstack/react-query';
import { fetchRoles } from '../../lib/roles-api';

export function RoleSelect({
  id,
  value,
  onChange,
  excludeResponder = false,
}: {
  id?: string;
  value: string;
  onChange: (role: string) => void;
  /**
   * Responder accounts can only be created via a department head's own
   * responder-creation flow, not general user management (backend rejects
   * it either way) — pass true to hide it from this picker. Callers editing
   * an existing responder should leave this false so the account's current
   * role still appears and a no-op save keeps working.
   */
  excludeResponder?: boolean;
}) {
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles', { is_active: true, picker: true }],
    queryFn: () => fetchRoles({ is_active: true }),
  });
  const options = (roles ?? []).filter((role) => !excludeResponder || role.slug !== 'responder');

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
      {options.map((role) => (
        <option key={role.slug} value={role.slug}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
