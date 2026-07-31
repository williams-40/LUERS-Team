import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '../lib/departments-api';
import { Button } from '../components/ui/Button';
import type { Department } from '../types/domain';

function DepartmentRow({ department }: { department: Department }) {
  return (
    <Link
      to={`/admin/departments/${department.id}/edit`}
      className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 transition hover:border-black/20"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{department.name}</span>
          {!department.is_active && (
            <span className="bg-ink-muted/18 text-ink-secondary rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Inactive
            </span>
          )}
        </div>
        <p className="text-ink-secondary truncate text-[12.5px]">
          {department.head_username ? `Head: ${department.head_username}` : 'No head assigned'} ·{' '}
          {department.member_usernames.length} member{department.member_usernames.length === 1 ? '' : 's'}
        </p>
      </div>
    </Link>
  );
}

export function DepartmentsPage() {
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['departments', isActive, page],
    queryFn: () => fetchDepartments({ is_active: isActive, page }),
  });

  function setActiveFilter(value: string): void {
    setIsActive(value === '' ? undefined : value === 'true');
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Departments</h1>
        <Link to="/admin/departments/new">
          <Button variant="primary" size="sm">
            New department
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Status</span>
          <select
            value={isActive === undefined ? '' : String(isActive)}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="rounded-lg border-[1.5px] border-black/15 px-2.5 py-1.5 text-sm"
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
          Couldn't load departments. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">No departments match these filters.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((department) => (
            <DepartmentRow key={department.id} department={department} />
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
