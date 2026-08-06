import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPendingFeedbackReports } from '../../lib/reports-api';
import { FeedbackModal } from '../reports/FeedbackModal';
import { useAuth } from '../../hooks/useAuth';
import { useReportSocket } from '../../hooks/useReportSocket';
import { Status } from '../../types/domain';

/**
 * Global auto-prompt: checks once on load/login for the caller's own
 * Resolved reports with no feedback yet, and re-checks live on any
 * campus-wide report_updated WS event (no reportId — same general 'reports'
 * group TriageQueuePage already subscribes to) so a report moving to
 * Resolved surfaces the popup without a reload.
 */
export function FeedbackPrompt() {
  const { isAuthenticated } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const { data, refetch } = useQuery({
    queryKey: ['reports', 'pending-feedback'],
    queryFn: fetchPendingFeedbackReports,
    enabled: isAuthenticated,
  });

  const handleReportUpdated = useCallback(
    (report: { status: string }) => {
      if (report.status === Status.RESOLVED) void refetch();
    },
    [refetch],
  );

  useReportSocket({ onReportUpdated: handleReportUpdated });

  const pending = (data?.results ?? []).filter((r) => !dismissedIds.includes(r.id));
  const next = pending[0];

  if (!next) return null;

  return (
    <FeedbackModal
      report={next}
      onSubmitted={() => {
        setDismissedIds((prev) => [...prev, next.id]);
        void refetch();
      }}
      onDismiss={() => setDismissedIds((prev) => [...prev, next.id])}
    />
  );
}
