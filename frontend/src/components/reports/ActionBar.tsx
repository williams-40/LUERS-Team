import type { ReactNode } from 'react';

/**
 * Fixed bottom bar for the merged emergency report form — keeps the panic
 * button reachable no matter how far the reporter has scrolled into the
 * optional "Add details" section. Sits at z-[900]: above ordinary page
 * content, below every overlay tier that can legitimately cover it
 * (MobileDrawer 1100, Modal 1200, Toast 1500, CameraOverlay 1400).
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface fixed inset-x-0 bottom-0 z-[900] border-t border-ink/10 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-xl flex-col gap-3">{children}</div>
    </div>
  );
}
