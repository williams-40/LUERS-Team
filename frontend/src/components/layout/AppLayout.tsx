import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { PendingReportsIndicator } from './PendingReportsIndicator';
import { InstallPrompt } from './InstallPrompt';
import { RouteLoadingFallback } from './RouteLoadingFallback';
import { FeedbackPrompt } from './FeedbackPrompt';
import { useAuth } from '../../hooks/useAuth';

export function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Reachable from anywhere except the emergency screen itself and the
  // logged-out auth pages — a person in danger shouldn't have to first
  // navigate to the report-create form to find this.
  const showEmergencyButton =
    isAuthenticated && user?.permissions.includes('create_report') && location.pathname !== '/emergency';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-surface-2 flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
        <Logo className="h-9 w-auto" />
        <span className="font-heading text-brand-ink mr-auto text-sm font-bold">LUERS</span>
        {showEmergencyButton && (
          <button
            type="button"
            onClick={() => navigate('/emergency')}
            className="bg-status-critical flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-extrabold text-white shadow-[0_2px_10px_rgba(208,59,59,0.35)] active:scale-[0.98]"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
            Emergency
          </button>
        )}
        <InstallPrompt />
        <PendingReportsIndicator />
      </header>
      <main className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <FeedbackPrompt />
    </div>
  );
}
