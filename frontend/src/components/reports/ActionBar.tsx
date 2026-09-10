import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Fixed bottom bar for the merged emergency report form — keeps the panic
 * button reachable no matter how far the reporter has scrolled into the
 * optional "Add details" section. Sits at z-[900]: above ordinary page
 * content, below every overlay tier that can legitimately cover it
 * (MobileDrawer 1100, Modal 1200, CameraOverlay 1400).
 *
 * Publishes its own rendered height as `--action-bar-offset` on <html>
 * while mounted, so ToastContainer (fixed bottom-5) can offset itself
 * above the bar instead of being hidden behind it — the one other
 * fixed-bottom element in the app. Measured via ResizeObserver, not a
 * fixed constant, since the inline error banner inside the bar changes
 * its height.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    function setOffset(height: number) {
      document.documentElement.style.setProperty('--action-bar-offset', `${height}px`);
    }

    setOffset(el.offsetHeight);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setOffset(entry.contentRect.height);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--action-bar-offset');
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="bg-surface fixed inset-x-0 bottom-0 z-[900] border-t border-ink/10 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-3">{children}</div>
    </div>
  );
}
