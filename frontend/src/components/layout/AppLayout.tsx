import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Logo } from './Logo';
import { PendingReportsIndicator } from './PendingReportsIndicator';
import { RouteLoadingFallback } from './RouteLoadingFallback';

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-surface-2 flex items-center justify-between gap-3 border-b border-black/10 px-5 py-3">
        <Logo className="h-9 w-auto" />
        <span className="font-heading text-brand-ink mr-auto text-sm font-bold">LUERS</span>
        <PendingReportsIndicator />
      </header>
      <main className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
