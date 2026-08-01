import { Role } from '../../types/domain';
import { ROLE_LABELS } from '../../lib/labels';

const ROLE_OPTIONS = Object.values(Role);

export function RoleSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
    >
      {ROLE_OPTIONS.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}
