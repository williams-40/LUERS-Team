import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRoles } from '../lib/roles-api';
import type { Role } from '../lib/roles-api';
import { Button } from '../components/ui/Button';

function RoleRow({ role }: { role: Role }) {
  return (
    <Link
      to={role.is_builtin ? '#' : `/admin/roles/${role.id}/edit`}
      onClick={(e) => {
        if (role.is_builtin) e.preventDefault();
      }}
      className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3 transition hover:border-ink/20"
      aria-disabled={role.is_builtin}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{role.label}</span>
          {role.is_builtin && (
            <span className="bg-ink-muted/18 text-ink-secondary rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Built-in
            </span>
          )}
          {!role.is_active && (
            <span className="bg-status-critical/10 text-status-critical rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Inactive
            </span>
          )}
        </div>
        <p className="text-ink-secondary truncate text-[12.5px]">
          {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
          {role.description ? ` · ${role.description}` : ''}
        </p>
      </div>
    </Link>
  );
}

export function RolesPage() {
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);

  const { data: roles, isLoading, isError } = useQuery({
    queryKey: ['roles', isActive],
    queryFn: () => fetchRoles({ is_active: isActive }),
  });

  function setActiveFilter(value: string): void {
    setIsActive(value === '' ? undefined : value === 'true');
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Roles</h1>
        <Link to="/admin/roles/new">
          <Button variant="primary" size="sm">
            New role
          </Button>
        </Link>
      </div>

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
          Couldn't load roles. Please try again.
        </p>
      )}

      {roles && roles.length === 0 && <p className="text-ink-secondary text-sm">No roles match these filters.</p>}

      {roles && roles.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {roles.map((role) => (
            <RoleRow key={role.id} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}
