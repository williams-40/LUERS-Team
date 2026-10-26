import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavList } from './NavList';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth }));
vi.mock('../../lib/reports-api', () => ({
  fetchReportQueue: vi.fn().mockResolvedValue({ page: { count: 0 }, results: [] }),
}));
vi.mock('../../lib/departments-api', () => ({
  fetchDepartments: vi.fn().mockResolvedValue({ results: [] }),
  HEAD_DETECTION_DEPARTMENTS_QUERY_KEY: ['departments', 'head-detection'],
}));

const ADMIN_PERMISSIONS = [
  'create_report',
  'view_admin_dashboard',
  'view_all_reports',
  'manage_users',
  'manage_departments',
  'manage_emergency_categories',
  'manage_roles',
  'delete_report',
];

function renderNav(path: string, collapsed = false) {
  useAuth.mockReturnValue({ user: { id: 1, permissions: ADMIN_PERMISSIONS } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <NavList collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function activeLabels(): string[] {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent ?? '');
}

describe('NavList active state', () => {
  it('highlights only "Report queue" on /admin', () => {
    renderNav('/admin');
    expect(activeLabels()).toEqual(['Report queue']);
  });

  it.each([
    ['/admin/emergency-categories', 'Emergency categories'],
    ['/admin/users', 'Users'],
    ['/admin/departments', 'Departments'],
    ['/admin/roles', 'Roles'],
    ['/admin/analytics', 'Analytics'],
    ['/admin/audit', 'Audit log'],
  ])('highlights only the current item on %s', (path, label) => {
    renderNav(path);
    expect(activeLabels()).toEqual([label]);
  });

  it('keeps prefix matching for sub-routes of a section', () => {
    renderNav('/admin/users/new');
    expect(activeLabels()).toEqual(['Users']);
  });

  it('highlights only the current item when the sidebar is collapsed', () => {
    renderNav('/admin/users', true);
    expect(activeLabels()).toEqual(['Users']);
  });

  it('still highlights "Report queue" on /admin when the sidebar is collapsed', () => {
    renderNav('/admin', true);
    expect(activeLabels()).toEqual(['Report queue']);
  });
});
