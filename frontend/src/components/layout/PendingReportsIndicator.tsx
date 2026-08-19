import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { Urgency } from '../../types/domain';
import { cn } from '../../lib/utils';

export function PendingReportsIndicator() {
  const { t } = useTranslation();
  const { queue, retryNow } = useOfflineQueue();
  const [retrying, setRetrying] = useState(false);

  if (queue.length === 0) return null;

  // The comparator in lib/offline-queue.ts already sorts panic-queued
  // reports to the front, so this is just "is the head of the queue panic."
  const hasPanicQueued = queue[0]?.payload.urgency === Urgency.PANIC;

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryNow();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold',
        hasPanicQueued ? 'bg-status-critical/15' : 'bg-status-warning/15',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          hasPanicQueued ? 'bg-status-critical animate-pulse motion-reduce:animate-none' : 'bg-status-warning',
        )}
      />
      <span>
        {t(hasPanicQueued ? 'pendingReports.pendingEmergency' : 'pendingReports.pending', { count: queue.length })}
      </span>
      <button
        type="button"
        onClick={() => void handleRetry()}
        disabled={retrying}
        className="text-brand underline disabled:opacity-50"
      >
        {retrying ? t('pendingReports.retrying') : t('pendingReports.retryNow')}
      </button>
    </div>
  );
}
