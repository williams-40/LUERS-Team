import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Logo } from './Logo';
import { InstallPrompt } from './InstallPrompt';
import { PendingReportsIndicator } from './PendingReportsIndicator';
import { UserMenu } from './UserMenu';

/**
 * Stays visible regardless of sidebar collapse state or mobile drawer
 * open/closed. The emergency flow itself is the report form
 * (EmergencyReportPage) — this top bar doesn't duplicate its panic button.
 *
 * When the desktop sidebar is collapsed, its own logo/"LUERS" wordmark
 * would be squeezed into a 68px rail — shown here instead, at full size,
 * so it stays legible. `md:hidden` on the sidebar means this only needs
 * to appear at md+ (mobile always uses the drawer's own logo).
 */
export function TopBar({ collapsed, onOpenDrawer }: { collapsed: boolean; onOpenDrawer: () => void }) {
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

      {collapsed && (
        <Link to="/" className="hidden shrink-0 items-center gap-2 md:flex">
          <Logo className="h-8 w-auto shrink-0 md:h-9 lg:h-10" />
          <span className="font-heading text-brand-ink text-base font-bold">LUERS</span>
        </Link>
      )}

      <div className="min-w-0 flex-1" />

      <InstallPrompt />
      <PendingReportsIndicator />
      <UserMenu />
    </header>
  );
}
