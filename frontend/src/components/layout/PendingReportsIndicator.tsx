import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

export function PendingReportsIndicator() {
  const { t } = useTranslation();
  const { queue, retryNow } = useOfflineQueue();
  const [retrying, setRetrying] = useState(false);

  if (queue.length === 0) return null;

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryNow();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="bg-status-warning/15 flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold">
      <span className="bg-status-warning h-1.5 w-1.5 shrink-0 rounded-full" />
      <span>{t('pendingReports.pending', { count: queue.length })}</span>
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
