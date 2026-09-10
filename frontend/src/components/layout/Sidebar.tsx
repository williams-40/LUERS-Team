import { Link } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Logo } from './Logo';
import { NavList } from './NavList';
import { cn } from '../../lib/utils';

/**
 * Desktop collapsible nav rail. Hidden below md; MobileDrawer covers small
 * screens instead. Collapse state is owned by AppShell (not local to this
 * component) — collapsed, the logo/"LUERS" wordmark moves to TopBar
 * instead of squeezing into this rail's 68px width, so both need to read
 * the same flag.
 */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'bg-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 py-4 transition-[width] md:flex',
        collapsed ? 'w-[68px] px-2.5' : 'w-64 px-3.5',
      )}
    >
      {!collapsed && (
        <Link to="/" className="mb-5 flex items-center gap-2 px-1">
          <Logo variant="light" className="h-8 w-auto shrink-0" />
          <span className="font-heading text-sidebar-ink text-sm font-bold">LUERS</span>
        </Link>
      )}

      <div className="flex-1 overflow-y-auto">
        <NavList collapsed={collapsed} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'text-sidebar-ink-muted hover:bg-sidebar-hover-bg hover:text-sidebar-ink mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
          collapsed && 'justify-center',
        )}
      >
        {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
        {!collapsed && 'Collapse'}
      </button>
    </aside>
  );
}
