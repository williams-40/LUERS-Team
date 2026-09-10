import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { DashboardSummaryPanel } from '../components/dashboard/DashboardSummaryPanel';
import { MyDepartmentResponders } from '../components/dashboard/MyDepartmentResponders';
import { MyAssignedReportsPanel } from '../components/dashboard/MyAssignedReportsPanel';
import { EscalatedReportsPanel } from '../components/dashboard/EscalatedReportsPanel';
import { fetchDepartments, HEAD_DETECTION_DEPARTMENTS_QUERY_KEY } from '../lib/departments-api';

export function DashboardPage() {
  const { user } = useAuth();
  const has = (permission: string) => Boolean(user?.permissions.includes(permission));
  const isReporter = has('create_report');
  const canSeeSummary = has('view_admin_dashboard');
  const isSystemAdmin = has('view_all_reports');

  // Phase 7: which of the manager-oriented panels make sense depends on
  // whether this dashboard-capable user actually manages anything — a
  // plain responder gets a focused "my assigned reports" view instead (see
  // MyAssignedReportsPanel for why). Shares its fetch with
  // DashboardSummaryPanel/MyDepartmentResponders via the same query key.
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

      {/* The rest of navigation now lives in the sidebar (see nav-config.ts) —
          this stays as the one primary action a reporter's dashboard needs. */}
      {isReporter && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link to="/emergency">
            <Button variant="primary">Report an incident</Button>
          </Link>
          <Link to="/reports/mine">
            <Button variant="secondary">My reports</Button>
          </Link>
        </div>
      )}

      {isSystemAdmin && <EscalatedReportsPanel />}
      {canSeeSummary && <DashboardSummaryPanel />}
      {canSeeSummary && isDepartmentHead && <MyDepartmentResponders />}
      {canSeeSummary && !isManagerTier && <MyAssignedReportsPanel />}

      {/* Trends/analytics moved to their own page (nav-config.ts's Insights
          group) — this stays as the one entry point from Home. */}
      {canSeeSummary && isManagerTier && (
        <Link to="/admin/analytics">
          <Button type="button" variant="secondary" className="mb-6">
            <BarChart3 className="h-4 w-4" aria-hidden />
            View analytics
          </Button>
        </Link>
      )}
    </div>
  );
}
