import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Role } from '../../types/domain';
import { RequireAuth } from './RequireAuth';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth }));

function renderProtected(roles?: Role[]) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <RequireAuth roles={roles}>
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

  it('renders children when authenticated and no roles are required', () => {
    useAuth.mockReturnValue({ user: { role: Role.STUDENT }, isAuthenticated: true, isLoading: false });
    renderProtected();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders children when the user has one of the required roles', () => {
    useAuth.mockReturnValue({ user: { role: Role.SECURITY }, isAuthenticated: true, isLoading: false });
    renderProtected([Role.SECURITY, Role.ICT_ADMIN]);
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /forbidden when the user lacks a required role', () => {
    useAuth.mockReturnValue({ user: { role: Role.STUDENT }, isAuthenticated: true, isLoading: false });
    renderProtected([Role.SECURITY]);
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
  });
});
