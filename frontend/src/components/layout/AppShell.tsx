import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Logo } from './Logo';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { TopBar } from './TopBar';
import { RouteLoadingFallback } from './RouteLoadingFallback';
import { FeedbackPrompt } from './FeedbackPrompt';

const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1300] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'luers-sidebar-collapsed';

/**
 * Replaces the old single-header AppLayout. Signed-in users get the full
 * shell (collapsible sidebar + top bar); logged-out/public pages (login,
 * register, style guide, ...) get a minimal header only — there's nothing
 * for a sidebar to navigate to before authentication.
 */
export function AppShell() {
  const { isAuthenticated } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Owned here (not inside Sidebar) so TopBar can show the logo/wordmark in
  // its place when collapsed — both need to read the same flag.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true',
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className={SKIP_LINK_CLASS}>
          Skip to main content
        </a>
        <header className="bg-surface-2 flex items-center gap-2 border-b border-ink/10 px-5 py-3">
          <Logo className="h-10 w-auto sm:h-11 md:h-12" />
          <span className="font-heading text-brand-ink text-base font-bold">LUERS</span>
        </header>
        <main id="main-content" className="flex-1">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className={SKIP_LINK_CLASS}>
        Skip to main content
      </a>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar collapsed={sidebarCollapsed} onOpenDrawer={() => setDrawerOpen(true)} />
        {/* [transform:translateZ(0)] is a visual no-op, but it establishes a
            new containing block for `position: fixed` descendants (ActionBar,
            on the emergency report page) — scoped to *this* box, which
            already excludes the sidebar's width, instead of the raw
            viewport. Without it, a fixed child centers itself across the
            whole screen (sidebar included), landing off-center from the
            page's own `mx-auto max-w-xl` content column. Portaled overlays
            (Modal/Toast/MobileDrawer/CameraOverlay) render straight onto
            document.body and are unaffected either way. */}
        <main id="main-content" className="flex-1 [transform:translateZ(0)]">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <FeedbackPrompt />
      </div>
    </div>
  );
}
