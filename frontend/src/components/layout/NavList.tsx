import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { NAV_GROUPS, isNavItemVisible } from '../../lib/nav-config';
import { Tooltip } from '../ui/Tooltip';
import { fetchReportQueue } from '../../lib/reports-api';
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

  // Responders and department heads (and anyone else who can reach the
  // queue) get a live count of unactioned reports on "Report queue" —
  // get_accessible_reports already scopes this per-role server-side (a
  // responder sees their department's/assigned new reports, a head sees
  // their department's, system_admin sees all), so one plain status=new
  // count works for everyone without special-casing a role here.
  const canSeeQueue = permissions.includes('view_admin_dashboard');
  const { data: newReportsData } = useQuery({
    queryKey: ['reports', 'queue', 'new-count'],
    queryFn: () => fetchReportQueue({ status: Status.NEW }),
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
