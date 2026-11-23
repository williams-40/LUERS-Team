import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getQueuedReports, OFFLINE_QUEUE_KEY } from '../lib/offline-queue';
import { flushQueue } from '../lib/offline-sync';
import { useAuth } from './useAuth';

const FLUSH_INTERVAL_MS = 30_000;

/**
 * Surfaces the offline report outbox and keeps it draining: on mount, on
 * the browser's `online` event, and on a polling interval while the tab is
 * open (the `online` event alone under-fires on some platforms). Only
 * active once authenticated, since a flush attempt needs a valid session.
 */
export function useOfflineQueue() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: queue = [] } = useQuery({
    queryKey: OFFLINE_QUEUE_KEY,
    queryFn: getQueuedReports,
    // Reflects IndexedDB state, not server data — refreshed via explicit
    // invalidation (enqueue/flush), not refetch heuristics.
    staleTime: Infinity,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_KEY }),
    [queryClient],
  );

  const retryNow = useCallback(async () => {
    await flushQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated) return;

    void retryNow();

    function handleOnline() {
      void retryNow();
    }
    window.addEventListener('online', handleOnline);
    const interval = setInterval(() => void retryNow(), FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [isAuthenticated, retryNow]);

  return { queue, retryNow, refresh };
}
