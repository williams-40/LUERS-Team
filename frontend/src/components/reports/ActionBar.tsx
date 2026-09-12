import type { ReactNode } from 'react';

/**
 * Fixed-position wrapper for the emergency send button — keeps it
 * reachable no matter how far the reporter has scrolled into the
 * optional "Add details" section, without acting like a separate
 * opaque toolbar: no background/border/shadow of its own, so it stays
 * visually part of the page underneath rather than a distinct bar
 * layered over it. The button itself is a normal centered button, not
 * stretched edge-to-edge.
 *
 * `left-[var(--sidebar-width,0px)]` (instead of `inset-x-0`) excludes
 * the desktop sidebar from the band this centers within — Sidebar.tsx
 * publishes its own real rendered width as that variable — so the
 * button lands centered on "Report an emergency"'s own content column,
 * not the raw screen. This stays genuinely `position: fixed` (relative
 * to the true viewport, so it never scrolls away): the variable only
 * adjusts the band's left edge, it doesn't change what the fixed
 * positioning is relative to.
 *
 * `pointer-events-none` on that full-band outer strip (paired with
 * `-auto` on the actual content) means the transparent margins on
 * either side of the centered button never swallow a tap meant for
 * whatever's on the page behind them.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-0 left-[var(--sidebar-width,0px)] right-0 z-[900] flex justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3">{children}</div>
    </div>
  );
}
