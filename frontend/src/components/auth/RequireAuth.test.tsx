import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth }));

function renderProtected(requirePermission?: string, initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <RequireAuth requirePermission={requirePermission}>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
        <Route
          path="/change-password-required"
          element={
            <RequireAuth>
              <div>Change password page</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/forbidden" element={<div>Forbidden page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function userWithPermissions(permissions: string[], extra: Partial<{ must_change_password: boolean }> = {}) {
  return { role: { slug: 'test-role', label: 'Test Role' }, permissions, ...extra };
}

describe('RequireAuth', () => {
  it('shows a loading spinner while auth state is resolving', () => {
    useAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: true });
    const { container } = renderProtected();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    useAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false });
    renderProtected();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders children when authenticated and no permission is required', () => {
    useAuth.mockReturnValue({ user: userWithPermissions(['create_report']), isAuthenticated: true, isLoading: false });
    renderProtected();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders children when the user has the required permission', () => {
    useAuth.mockReturnValue({
      user: userWithPermissions(['view_admin_dashboard', 'manage_audit_logs']),
      isAuthenticated: true,
      isLoading: false,
    });
    renderProtected('view_admin_dashboard');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /forbidden when the user lacks the required permission', () => {
    useAuth.mockReturnValue({ user: userWithPermissions(['create_report']), isAuthenticated: true, isLoading: false });
    renderProtected('view_admin_dashboard');
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
  });

  it('redirects to /change-password-required when must_change_password is set', () => {
    useAuth.mockReturnValue({
      user: userWithPermissions(['create_report'], { must_change_password: true }),
      isAuthenticated: true,
      isLoading: false,
    });
    renderProtected();
    expect(screen.getByText('Change password page')).toBeInTheDocument();
  });

  it('does not redirect-loop when already on /change-password-required', () => {
    useAuth.mockReturnValue({
      user: userWithPermissions(['create_report'], { must_change_password: true }),
      isAuthenticated: true,
      isLoading: false,
    });
    renderProtected(undefined, '/change-password-required');
    expect(screen.getByText('Change password page')).toBeInTheDocument();
  });
});
