import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth }));

function renderProtected(requirePermission?: string) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <RequireAuth requirePermission={requirePermission}>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/forbidden" element={<div>Forbidden page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function userWithPermissions(permissions: string[]) {
  return { role: { slug: 'test-role', label: 'Test Role' }, permissions };
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
});
