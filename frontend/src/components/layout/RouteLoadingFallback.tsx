/** Suspense fallback for lazy-loaded routes — a generic "chunk still
 * downloading" indicator, distinct from the content-shaped Skeleton
 * components used for data-loading states. */
export function RouteLoadingFallback() {
  return (
    <div className="flex justify-center py-16">
      <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}
