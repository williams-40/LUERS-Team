import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Logo } from './Logo';
import { NavList } from './NavList';
import { cn } from '../../lib/utils';

const STORAGE_KEY = 'luers-sidebar-collapsed';

/** Desktop collapsible nav rail. Hidden below md; MobileDrawer covers small screens instead. */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={cn(
        'bg-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink/10 py-4 transition-[width] md:flex',
        collapsed ? 'w-[68px] px-2.5' : 'w-64 px-3.5',
      )}
    >
      <Link to="/" className={cn('mb-5 flex items-center gap-2 px-1', collapsed && 'justify-center')}>
        <Logo className="h-8 w-auto shrink-0" />
        {!collapsed && <span className="font-heading text-brand-ink text-sm font-bold">LUERS</span>}
      </Link>

      <div className="flex-1 overflow-y-auto">
        <NavList collapsed={collapsed} />
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'text-ink-muted hover:bg-brand/10 hover:text-ink mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
          collapsed && 'justify-center',
        )}
      >
        {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
        {!collapsed && 'Collapse'}
      </button>
    </aside>
  );
}
