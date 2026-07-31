import type { User } from '../../types/domain';

/** Checkbox picker over a pre-fetched list of admin-tier users — see DepartmentFormPage,
 * which fetches that list once via fetchUsers({ role: 'security,ict_admin,management,system_admin' })
 * and shares it with this component and the head <select> alongside it. */
export function UserMultiSelect({
  users,
  value,
  onChange,
}: {
  users: User[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  if (users.length === 0) {
    return <p className="text-ink-muted text-sm">No admin-tier users available.</p>;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-black/15 p-3">
      {users.map((user) => (
        <label key={user.id} className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-brand h-4 w-4"
            checked={value.includes(user.id)}
            onChange={() => toggle(user.id)}
          />
          <span className="text-sm">{user.username}</span>
        </label>
      ))}
    </div>
  );
}
