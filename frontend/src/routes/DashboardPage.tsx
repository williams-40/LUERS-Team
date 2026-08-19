import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { DashboardSummaryPanel } from '../components/dashboard/DashboardSummaryPanel';
import { DashboardTrendsPanel } from '../components/dashboard/DashboardTrendsPanel';
import { DashboardAnalyticsPanel } from '../components/dashboard/DashboardAnalyticsPanel';
import { MyDepartmentResponders } from '../components/dashboard/MyDepartmentResponders';
import { MyAssignedReportsPanel } from '../components/dashboard/MyAssignedReportsPanel';
import { EscalatedReportsPanel } from '../components/dashboard/EscalatedReportsPanel';
import { fetchDepartments, HEAD_DETECTION_DEPARTMENTS_QUERY_KEY } from '../lib/departments-api';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const has = (permission: string) => Boolean(user?.permissions.includes(permission));
  const isReporter = has('create_report');
  const canSeeSummary = has('view_admin_dashboard');
  const isSystemAdmin = has('view_all_reports');

  // Phase 7: which of the manager-oriented panels (Trends/Analytics) make
  // sense depends on whether this dashboard-capable user actually manages
  // anything — a plain responder gets a focused "my assigned reports"
  // view instead (see MyAssignedReportsPanel for why). Shares its fetch
  // with DashboardSummaryPanel/MyDepartmentResponders via the same query key.
  const { data: departments } = useQuery({
    queryKey: HEAD_DETECTION_DEPARTMENTS_QUERY_KEY,
    queryFn: () => fetchDepartments({ is_active: true }),
    enabled: canSeeSummary && !isSystemAdmin,
  });
  const isDepartmentHead = Boolean(user && departments?.results.some((d) => d.head === user.id));
  const isManagerTier = isSystemAdmin || isDepartmentHead;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">Welcome{user ? `, ${user.username}` : ''}</h1>
      <p className="text-ink-secondary mb-6 text-sm">Signed in as {user ? user.role.label : '…'}.</p>

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

      {canSeeSummary && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link to="/admin">
            <Button variant="primary">Report queue</Button>
          </Link>
          {/* Phase 4: manage_audit_logs removed — audit access is now
              purely object/query-level server-side, so this link just
              follows the same admin-tier gate as the queue itself. */}
          <Link to="/admin/audit">
            <Button variant="secondary">Audit log</Button>
          </Link>
        </div>
      )}

      {(has('manage_users') || has('manage_departments') || has('delete_report') || has('manage_roles')) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {has('manage_users') && (
            <Link to="/admin/users">
              <Button variant="secondary">Manage users</Button>
            </Link>
          )}
          {has('manage_departments') && (
            <Link to="/admin/departments">
              <Button variant="secondary">Departments</Button>
            </Link>
          )}
          {has('delete_report') && (
            <Link to="/admin/reports/deleted">
              <Button variant="secondary">Deleted reports</Button>
            </Link>
          )}
          {has('manage_roles') && (
            <Link to="/admin/roles">
              <Button variant="secondary">Roles</Button>
            </Link>
          )}
          {has('view_all_reports') && (
            <Link to="/admin/feedback">
              <Button variant="secondary">Feedback</Button>
            </Link>
          )}
        </div>
      )}

      {isSystemAdmin && <EscalatedReportsPanel />}
      {canSeeSummary && <DashboardSummaryPanel />}
      {canSeeSummary && isDepartmentHead && <MyDepartmentResponders />}
      {canSeeSummary && !isManagerTier && <MyAssignedReportsPanel />}
      {canSeeSummary && isManagerTier && <DashboardTrendsPanel />}
      {canSeeSummary && isManagerTier && <DashboardAnalyticsPanel />}

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
