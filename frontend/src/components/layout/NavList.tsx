import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NAV_GROUPS, isNavItemVisible } from '../../lib/nav-config';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

/**
 * Shared nav-item list rendered by both the desktop Sidebar and the mobile
 * drawer, so the two never drift out of sync on which items/permissions
 * they show.
 */
export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => isNavItemVisible(item, permissions));
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed && (
              <span className="text-ink-muted px-2.5 text-[11px] font-semibold tracking-wide uppercase">
                {group.label}
              </span>
            )}
            {visibleItems.map((item) => {
              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                      collapsed && 'justify-center',
                      isActive
                        ? 'bg-brand/10 text-brand'
                        : 'text-ink-secondary hover:bg-ink/6 hover:text-ink',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
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
