import { useQuery } from '@tanstack/react-query';
import { Clock, UserCheck, AlertTriangle, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchDashboardSummary, fetchDashboardAnalytics } from '../lib/dashboard-api';
import { fetchDepartments, HEAD_DETECTION_DEPARTMENTS_QUERY_KEY } from '../lib/departments-api';
import { KPIStatCard } from '../components/dashboard/KPIStatCard';
import { ReportsTrendChart } from '../components/charts/ReportsTrendChart';
import { StatusBreakdownChart } from '../components/charts/StatusBreakdownChart';
import { UrgencyBreakdownChart } from '../components/charts/UrgencyBreakdownChart';
import { DepartmentBreakdownChart } from '../components/charts/DepartmentBreakdownChart';
import { MonthlyTrendChart } from '../components/charts/MonthlyTrendChart';
import { ResponderWorkloadChart } from '../components/charts/ResponderWorkloadChart';
import { ResponderPerformanceList } from '../components/charts/ResponderPerformanceList';
import { TopKeywordsCard } from '../components/charts/TopKeywordsCard';

/**
 * Reuses the exact same 3 dashboard endpoints (summary/trends/analytics)
 * DashboardPage's panels already call, under the same view_admin_dashboard
 * permission — this is a deeper view of the same data, not a new capability.
 * A department head sees this automatically scoped to their department
 * (get_accessible_reports on the backend), same as every other dashboard
 * panel — no client-side filtering needed here.
 */
export function AnalyticsPage() {
  const { user } = useAuth();
  const isSystemAdmin = Boolean(user?.permissions.includes('view_all_reports'));

  const { data: departments } = useQuery({
    queryKey: HEAD_DETECTION_DEPARTMENTS_QUERY_KEY,
    queryFn: () => fetchDepartments({ is_active: true }),
    enabled: !isSystemAdmin,
  });
  const isDepartmentHead = Boolean(user && departments?.results.some((d) => d.head === user.id));

  const summaryQuery = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: fetchDashboardSummary });
  const analyticsQuery = useQuery({ queryKey: ['dashboard', 'analytics'], queryFn: fetchDashboardAnalytics });
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = summaryQuery;
  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = analyticsQuery;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="mb-1 text-2xl">Analytics</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        {isSystemAdmin ? 'Campus-wide reporting trends and performance.' : 'Reporting trends and performance for your department.'}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPIStatCard
          label="Avg. time to resolve"
          icon={Clock}
          value={analytics?.average_resolution_time_hours != null ? `${analytics.average_resolution_time_hours.toFixed(1)}h` : 'N/A'}
        />
        <KPIStatCard
          label="Avg. time to assign"
          icon={UserCheck}
          value={analytics?.average_assignment_time_hours != null ? `${analytics.average_assignment_time_hours.toFixed(1)}h` : 'N/A'}
        />
        <KPIStatCard
          label="Overdue emergencies"
          icon={AlertTriangle}
          value={analytics?.overdue.panic ?? 'N/A'}
          tone={analytics && analytics.overdue.panic > 0 ? 'critical' : 'neutral'}
        />
        <KPIStatCard
          label="Overdue reports"
          icon={AlertTriangle}
          value={analytics?.overdue.normal ?? 'N/A'}
          tone={analytics && analytics.overdue.normal > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {analytics && analytics.feedback.feedback_count > 0 && (
        <div className="mb-6 max-w-[220px]">
          <KPIStatCard
            label="Feedback rating"
            icon={Star}
            value={`${analytics.feedback.average_rating?.toFixed(1) ?? 'N/A'} / 5`}
            tone="good"
          />
        </div>
      )}

      <div className="mb-4">
        <ReportsTrendChart />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatusBreakdownChart data={summary?.status_counts} isLoading={summaryLoading} isError={summaryError} />
        <UrgencyBreakdownChart data={analytics?.urgency_counts} isLoading={analyticsLoading} isError={analyticsError} />
      </div>

      {isSystemAdmin && (
        <div className="mb-4">
          <DepartmentBreakdownChart data={summary?.department_counts} isLoading={summaryLoading} isError={summaryError} />
        </div>
      )}

      <div className="mb-4">
        <MonthlyTrendChart data={analytics?.monthly_trend} isLoading={analyticsLoading} isError={analyticsError} />
      </div>

      {(isSystemAdmin || isDepartmentHead) && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ResponderWorkloadChart data={analytics?.responder_workload} isLoading={analyticsLoading} isError={analyticsError} />
          <ResponderPerformanceList data={analytics?.responder_performance} isLoading={analyticsLoading} isError={analyticsError} />
        </div>
      )}

      <TopKeywordsCard data={analytics?.top_keywords} isLoading={analyticsLoading} isError={analyticsError} />
    </div>
  );
}
