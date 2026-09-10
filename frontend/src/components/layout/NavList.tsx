import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { NAV_GROUPS, isNavItemVisible } from '../../lib/nav-config';
import { Tooltip } from '../ui/Tooltip';
import { fetchReportQueue } from '../../lib/reports-api';
import { fetchDepartments, HEAD_DETECTION_DEPARTMENTS_QUERY_KEY } from '../../lib/departments-api';
import { Status } from '../../types/domain';
import { cn } from '../../lib/utils';

const NEW_REPORTS_BADGE_PATH = '/admin';

/** Small saturated-red count pill — new-report badge on "Report queue". */
function NavBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null;
  if (collapsed) {
    return (
      <span
        className="bg-status-critical absolute top-1 right-1 h-2 w-2 rounded-full"
        aria-hidden
      />
    );
  }
  return (
    <span className="bg-status-critical ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count} new
    </span>
  );
}

/**
 * Shared nav-item list rendered by both the desktop Sidebar and the mobile
 * drawer, so the two never drift out of sync on which items/permissions
 * they show.
 */
export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  const canSeeQueue = permissions.includes('view_admin_dashboard');
  const isSystemAdmin = permissions.includes('view_all_reports');

  // A plain responder's "new" count on "Report queue" must mean new
  // reports assigned to *them* specifically (matching MyAssignedReportsPanel's
  // own badge) — not every new report their queue view happens to be able
  // to see. Department heads and System Admin, by contrast, want the
  // department-/system-wide new count, since their job is overseeing
  // everything unactioned, not just their own assignments. Reuses the
  // same shared query DashboardPage/DashboardSummaryPanel/
  // MyDepartmentResponders already fire (see HEAD_DETECTION_DEPARTMENTS_QUERY_KEY),
  // so this doesn't add a duplicate request for a head/admin.
  const { data: departmentsForHeadCheck } = useQuery({
    queryKey: HEAD_DETECTION_DEPARTMENTS_QUERY_KEY,
    queryFn: () => fetchDepartments({ is_active: true }),
    enabled: canSeeQueue && !isSystemAdmin,
  });
  const isDepartmentHead = Boolean(user && departmentsForHeadCheck?.results.some((d) => d.head === user.id));
  const scopeToOwnAssignments = canSeeQueue && !isSystemAdmin && !isDepartmentHead;

  const { data: newReportsData } = useQuery({
    queryKey: ['reports', 'queue', 'new-count', scopeToOwnAssignments ? user?.id : 'queue-wide'],
    queryFn: () =>
      fetchReportQueue({
        status: Status.NEW,
        ...(scopeToOwnAssignments ? { assigned_to: user!.id } : {}),
      }),
    enabled: canSeeQueue,
    refetchInterval: 30_000,
  });
  const newReportsCount = newReportsData?.page.count ?? 0;

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => isNavItemVisible(item, permissions));
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed && group.label && (
              <span className="text-sidebar-ink-muted px-2.5 text-[11px] font-semibold tracking-wide uppercase">
                {group.label}
              </span>
            )}
            {visibleItems.map((item) => {
              const badgeCount = item.path === NEW_REPORTS_BADGE_PATH ? newReportsCount : 0;
              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={onNavigate}
                  aria-label={
                    collapsed ? `${item.label}${badgeCount > 0 ? ` (${badgeCount} new)` : ''}` : undefined
                  }
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                      collapsed && 'justify-center',
                      // The sidebar is now a solid, saturated blue fill in
                      // both themes (not a page-surface tint), so its text
                      // comes from the dedicated sidebar-ink tokens rather
                      // than the general ink/brand tokens tuned for a light
                      // background.
                      isActive
                        ? 'bg-sidebar-active-bg text-sidebar-ink font-semibold'
                        : 'text-sidebar-ink-muted hover:bg-sidebar-hover-bg hover:text-sidebar-ink',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  <NavBadge count={badgeCount} collapsed={collapsed} />
                </NavLink>
              );

              return collapsed ? (
                <Tooltip key={item.path} label={item.label}>
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
