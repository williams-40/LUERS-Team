import type { ReactNode } from 'react';

/**
 * Fixed-position wrapper for the emergency send button — keeps it
 * reachable no matter how far the reporter has scrolled into the
 * optional "Add details" section, without acting like a separate
 * opaque toolbar: no background/border/shadow of its own, so it stays
 * visually part of the page underneath rather than a distinct bar
 * layered over it. The button itself is a normal centered button, not
 * stretched edge-to-edge — centered in the *page's own content column*,
 * not the raw viewport, because AppShell's `<main>` establishes a new
 * containing block for `fixed` descendants (see the comment there);
 * without that, `inset-x-0` here would span the sidebar too and the
 * button would land off-center from "Report an emergency"'s own
 * `mx-auto max-w-xl` column. `pointer-events-none` on the full-width
 * outer strip (paired with `-auto` on the actual content) means the
 * transparent margins on either side never swallow a tap meant for
 * whatever's on the page behind them.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] flex justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3">{children}</div>
    </div>
  );
}
