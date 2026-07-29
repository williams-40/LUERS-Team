import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { ROLE_LABELS } from '../lib/labels';
import { ADMIN_ROLES, REPORTER_ROLES, Role } from '../types/domain';
import { DashboardSummaryPanel } from '../components/dashboard/DashboardSummaryPanel';

/** Matches DashboardSummaryView's IsSecurity | IsICTAdmin permission — narrower than ADMIN_ROLES. */
const DASHBOARD_ROLES: Role[] = [Role.SECURITY, Role.ICT_ADMIN];

export function DashboardPage() {
  const { user, logout } = useAuth();
  const isReporter = user ? REPORTER_ROLES.includes(user.role) : false;
  const isAdminTier = user ? ADMIN_ROLES.includes(user.role) : false;
  const canSeeSummary = user ? DASHBOARD_ROLES.includes(user.role) : false;

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
        </div>
      )}

      {canSeeSummary && <DashboardSummaryPanel />}

      <Button variant="ghost" onClick={logout}>
        Sign out
      </Button>
    </div>
  );
}
