import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '../lib/admin-users-api';
import type { AdminUserFilters } from '../lib/admin-users-api';
import { Button } from '../components/ui/Button';
import { ROLE_LABELS } from '../lib/labels';
import { Role } from '../types/domain';
import type { User } from '../types/domain';

function UserRow({ user }: { user: User }) {
  return (
    <Link
      to={`/admin/users/${user.id}/edit`}
      className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3 transition hover:border-ink/20"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{user.username}</span>
          {!user.is_active && (
            <span className="bg-status-critical/10 text-status-critical rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Deactivated
            </span>
          )}
        </div>
        <p className="text-ink-secondary truncate text-[12.5px]">{user.email}</p>
      </div>
      <span className="bg-brand/10 text-brand shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold">
        {ROLE_LABELS[user.role] ?? user.role}
      </span>
    </Link>
  );
}

export function AdminUsersPage() {
  const [filters, setFilters] = useState<Omit<AdminUserFilters, 'page'>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users', filters, search, page],
    queryFn: () => fetchUsers({ ...filters, search: search || undefined, page }),
  });

  function setRoleFilter(role: Role | ''): void {
    setFilters((prev) => ({ ...prev, role: role || undefined }));
    setPage(1);
  }

  function setActiveFilter(value: string): void {
    setFilters((prev) => ({
      ...prev,
      is_active: value === '' ? undefined : value === 'true',
    }));
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Users</h1>
        <Link to="/admin/users/new">
          <Button variant="primary" size="sm">
            New user
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Search</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Username or email"
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Role</span>
          <select
            value={filters.role ?? ''}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          >
            <option value="">All</option>
            {Object.values(Role).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Status</span>
          <select
            value={filters.is_active === undefined ? '' : String(filters.is_active)}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
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
          Couldn't load users. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">No users match these filters.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((user) => (
            <UserRow key={user.id} user={user} />
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
