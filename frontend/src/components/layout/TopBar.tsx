import { Menu } from 'lucide-react';
import { InstallPrompt } from './InstallPrompt';
import { PendingReportsIndicator } from './PendingReportsIndicator';
import { UserMenu } from './UserMenu';

/**
 * Stays visible regardless of sidebar collapse state or mobile drawer
 * open/closed. The emergency flow itself is still reachable from the report
 * form's own panic button (ReportCreatePage) — this top bar no longer
 * duplicates it.
 */
export function TopBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
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

      <InstallPrompt />
      <PendingReportsIndicator />
      <UserMenu />
    </header>
  );
}
