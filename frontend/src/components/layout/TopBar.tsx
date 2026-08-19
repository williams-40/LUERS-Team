import { Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { InstallPrompt } from './InstallPrompt';
import { PendingReportsIndicator } from './PendingReportsIndicator';
import { UserMenu } from './UserMenu';

/**
 * Stays visible regardless of sidebar collapse state or mobile drawer
 * open/closed — the emergency button needs to be reachable no matter what,
 * exactly like it already was in the old single-header AppLayout.
 */
export function TopBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const showEmergencyButton =
    isAuthenticated && user?.permissions.includes('create_report') && location.pathname !== '/emergency';

  return (
    <header className="bg-surface-2 sticky top-0 z-40 flex items-center gap-3 border-b border-ink/10 px-4 py-3 md:px-5">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        className="text-ink-secondary hover:bg-ink/6 -ml-1 shrink-0 rounded-lg p-1.5 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1" />

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
      <UserMenu />
    </header>
  );
}
