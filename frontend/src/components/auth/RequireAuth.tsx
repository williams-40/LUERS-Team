import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface RequireAuthProps {
  /** Omit to allow any authenticated user, regardless of permissions. */
  requirePermission?: string;
  children: ReactNode;
}

export function RequireAuth({ requirePermission, children }: RequireAuthProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Temp-password accounts (department head/responder invites) must set
  // their own password before anything else — exempt only the page that
  // lets them do that, so this doesn't redirect-loop against itself.
  if (user?.must_change_password && location.pathname !== '/change-password-required') {
    return <Navigate to="/change-password-required" replace />;
  }

  if (requirePermission && user && !user.permissions.includes(requirePermission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
