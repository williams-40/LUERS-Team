import { Suspense, useState } from 'react';
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

/**
 * Replaces the old single-header AppLayout. Signed-in users get the full
 * shell (collapsible sidebar + top bar); logged-out/public pages (login,
 * register, style guide, ...) get a minimal header only — there's nothing
 * for a sidebar to navigate to before authentication.
 */
export function AppShell() {
  const { isAuthenticated } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className={SKIP_LINK_CLASS}>
          Skip to main content
        </a>
        <header className="bg-surface-2 flex items-center gap-2 border-b border-ink/10 px-5 py-3">
          <Logo className="h-9 w-auto" />
          <span className="font-heading text-brand-ink text-sm font-bold">LUERS</span>
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
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenDrawer={() => setDrawerOpen(true)} />
        <main id="main-content" className="flex-1">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <FeedbackPrompt />
      </div>
    </div>
  );
}
