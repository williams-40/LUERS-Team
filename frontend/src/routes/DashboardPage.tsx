import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { ROLE_LABELS } from '../lib/labels';
import { ACCOUNT_ADMIN_ROLES, ADMIN_ROLES, REPORTER_ROLES, Role } from '../types/domain';
import { DashboardSummaryPanel } from '../components/dashboard/DashboardSummaryPanel';
import { DashboardTrendsPanel } from '../components/dashboard/DashboardTrendsPanel';

/** Matches DashboardSummaryView's IsSecurity | IsICTAdmin permission — narrower than ADMIN_ROLES. */
const DASHBOARD_ROLES: Role[] = [Role.SECURITY, Role.ICT_ADMIN];

export function DashboardPage() {
  const { user, logout } = useAuth();
  const isReporter = user ? REPORTER_ROLES.includes(user.role) : false;
  const isAdminTier = user ? ADMIN_ROLES.includes(user.role) : false;
  const canSeeSummary = user ? DASHBOARD_ROLES.includes(user.role) : false;
  const isAccountAdmin = user ? ACCOUNT_ADMIN_ROLES.includes(user.role) : false;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">Welcome{user ? `, ${user.username}` : ''}</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        Signed in as {user ? (ROLE_LABELS[user.role] ?? user.role) : '…'}.
      </p>

      {isReporter && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link to="/reports/new">
            <Button variant="primary">Report an incident</Button>
          </Link>
          <Link to="/reports/mine">
            <Button variant="secondary">My reports</Button>
          </Link>
        </div>
      )}

      {isAdminTier && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link to="/admin">
            <Button variant="primary">Report queue</Button>
          </Link>
          <Link to="/admin/audit">
            <Button variant="secondary">Audit log</Button>
          </Link>
        </div>
      )}

      {isAccountAdmin && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link to="/admin/users">
            <Button variant="secondary">Manage users</Button>
          </Link>
          <Link to="/admin/departments">
            <Button variant="secondary">Departments</Button>
          </Link>
          <Link to="/admin/reports/deleted">
            <Button variant="secondary">Deleted reports</Button>
          </Link>
        </div>
      )}

      {canSeeSummary && <DashboardSummaryPanel />}
      {canSeeSummary && <DashboardTrendsPanel />}

      <div className="mb-4 flex flex-wrap gap-3">
        <Link to="/profile">
          <Button variant="ghost">My profile</Button>
        </Link>
      </div>

      <Button variant="ghost" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
