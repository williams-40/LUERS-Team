import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPendingFeedbackReports } from '../../lib/reports-api';
import { FeedbackModal } from '../reports/FeedbackModal';
import { Button } from '../ui/Button';
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
  // Set while the reporter is viewing the report from the "View report"
  // link — the modal steps aside (rather than floating on top of the
  // report page underneath, which they'd have no way to actually read)
  // and a small pill offers a way back into the same feedback flow.
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

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

  if (viewingReportId === next.id) {
    return (
      <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-full bg-surface-2 py-2 pr-2 pl-4 text-sm shadow-lg">
        <span className="text-ink-secondary">Feedback pending for this report</span>
        <Button size="sm" onClick={() => setViewingReportId(null)}>
          Continue feedback
        </Button>
        <button
          type="button"
          onClick={() => {
            setDismissedIds((prev) => [...prev, next.id]);
            setViewingReportId(null);
          }}
          aria-label="Dismiss"
          className="text-ink-muted shrink-0 px-1 font-semibold opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <FeedbackModal
      report={next}
      onSubmitted={() => {
        setDismissedIds((prev) => [...prev, next.id]);
        setViewingReportId(null);
        void refetch();
      }}
      onDismiss={() => {
        setDismissedIds((prev) => [...prev, next.id]);
        setViewingReportId(null);
      }}
      onViewReport={() => setViewingReportId(next.id)}
    />
  );
}
