import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReportQueue } from '../lib/reports-api';
import type { Category, Paginated, ReportListItem, Status, Urgency } from '../types/domain';

export interface QueueFilterState {
  status?: Status;
  category?: Category;
  urgency?: Urgency;
}

/**
 * Full fetch on filter/page change; "refresh" delta-fetches via the X-Cursor
 * from the last response and merges results in place (update matching ids,
 * prepend new ones) instead of replacing the whole page. Only meaningful on
 * page 1 with unchanged filters — changing either falls back to a full
 * refetch, since a delta response filtered on stale criteria can't be
 * trusted to represent the current view.
 *
 * Rough edge: `count` isn't recomputed on a delta merge (there's no cheap
 * way to know how many of the merged rows are genuinely new vs. updated) —
 * pagination controls reflect the last full fetch until the next one.
 */
export function useReportQueue(filters: QueueFilterState) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const cursorRef = useRef<string | null>(null);
  const filtersKey = `${filters.status ?? ''}|${filters.category ?? ''}|${filters.urgency ?? ''}`;
  const queryKey = ['reports', 'queue', filtersKey, page] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await fetchReportQueue({ ...filters, page });
      cursorRef.current = result.cursor;
      return result.page;
    },
  });

  function changePage(next: number) {
    cursorRef.current = null;
    setPage(next);
  }

  const refresh = useCallback(async () => {
    if (page !== 1) {
      changePage(1);
      return;
    }
    if (!cursorRef.current) {
      await queryClient.invalidateQueries({ queryKey });
      return;
    }
    const result = await fetchReportQueue({ ...filters, since: cursorRef.current });
    cursorRef.current = result.cursor ?? cursorRef.current;
    if (result.page.results.length === 0) return;

    queryClient.setQueryData<Paginated<ReportListItem>>(queryKey, (old) => {
      if (!old) return old;
      const merged = [...old.results];
      for (const updated of result.page.results) {
        const idx = merged.findIndex((r) => r.id === updated.id);
        if (idx >= 0) merged[idx] = updated;
        else merged.unshift(updated);
      }
      return { ...old, results: merged };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtersKey, queryClient]);

  return { ...query, page, setPage: changePage, refresh };
}
