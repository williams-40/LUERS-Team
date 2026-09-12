import { useEffect, useRef } from 'react';
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
 *
 * Publishes its own rendered width as `--sidebar-width` on <html> — the
 * emergency report page's fixed ActionBar reads it to center its panic
 * button within the actual content area rather than the raw viewport
 * (which would include this rail). Measured via ResizeObserver rather
 * than duplicating the collapsed/expanded pixel values or the `md`
 * breakpoint in JS: this rail is genuinely 0 width below `md` (`hidden`),
 * so observing its real box handles that for free. Kept as a CSS
 * variable, not a container-block trick on some ancestor, because
 * `position: fixed` must stay relative to the true viewport to remain
 * scroll-independent — an ancestor that itself scrolls with the page
 * would drag a "fixed" descendant along with it.
 */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;

    function setWidth() {
      document.documentElement.style.setProperty('--sidebar-width', `${el!.getBoundingClientRect().width}px`);
    }

    setWidth();
    const observer = new ResizeObserver(setWidth);
    observer.observe(el);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, []);

  return (
    <aside
      ref={asideRef}
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

      <div className="scrollbar-hidden flex-1 overflow-y-auto">
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
