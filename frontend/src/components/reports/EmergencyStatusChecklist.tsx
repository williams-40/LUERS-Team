import { Status } from '../../types/domain';
import type { ReportDetail } from '../../types/domain';
import { cn } from '../../lib/utils';

const STEPS = [
  { key: 'received', label: 'Emergency received' },
  { key: 'notified', label: 'Response team notified' },
  { key: 'acknowledged', label: 'Responder acknowledged' },
  { key: 'responding', label: 'Responder on the way' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Emergency resolved' },
] as const;

/**
 * Replaces the generic status badge with an emergency-specific live
 * checklist for panic reports — driven entirely by report.emergency_dispatch
 * (already refetched over the existing report_{id} WebSocket group, no new
 * realtime plumbing needed here).
 */
export function EmergencyStatusChecklist({ report }: { report: ReportDetail }) {
  const dispatch = report.emergency_dispatch;
  if (!dispatch) return null;

  const isCancelled = report.status === Status.CANCELLED;
  const isFalseAlarm = report.status === Status.FALSE_ALARM;
  const isClosed = isCancelled || isFalseAlarm;

  const isResolved =
    Boolean(dispatch.resolved_at) || report.status === Status.RESOLVED || report.status === Status.CLOSED;

  // A responder can jump status straight to ACKNOWLEDGED or IN_PROGRESS
  // via the generic status dropdown (StatusUpdateControl) instead of the
  // dedicated Acknowledge/Mark-responding actions — which set
  // acknowledged_at/responding_at as a side effect — so those timestamps
  // alone aren't a reliable "did this step happen" signal. Falling back to
  // status having already reached (or passed) the step it corresponds to
  // means a report that's visibly further along never shows an earlier
  // step as if nothing had happened yet.
  const statusReachedAcknowledged =
    report.status === Status.ACKNOWLEDGED || report.status === Status.IN_PROGRESS || isResolved;
  const statusReachedInProgress = report.status === Status.IN_PROGRESS || isResolved;

  const done: Record<(typeof STEPS)[number]['key'], boolean> = {
    received: true,
    // Multi-channel dispatch (WebSocket + SMS + email) always fires on
    // panic creation, see ReportService.create_report.
    notified: true,
    acknowledged: Boolean(dispatch.acknowledged_at) || statusReachedAcknowledged,
    responding: Boolean(dispatch.responding_at) || statusReachedInProgress,
    // Driven by status reaching IN_PROGRESS rather than the optional
    // arrived_at timestamp (set by a separate "Mark arrived" action a
    // responder can freely skip on the way to resolving), so this step
    // reliably completes instead of staying unchecked after resolution.
    in_progress: statusReachedInProgress,
    resolved: isResolved,
  };

  return (
    <div className="border-status-critical/30 bg-status-critical/5 mb-5 rounded-xl border px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-status-critical font-heading text-[13px] font-extrabold tracking-wide uppercase">
          {isCancelled ? 'Emergency cancelled' : isFalseAlarm ? 'Marked as false alarm' : 'Emergency active'}
        </span>
      </div>

      {!isClosed && (
        <ul className="flex flex-col gap-1.5">
          {STEPS.map((step) => (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-bold',
                  done[step.key] ? 'bg-status-good text-white' : 'border-[1.5px] border-ink/20 text-transparent',
                )}
              >
                ✓
              </span>
              <span className={done[step.key] ? 'text-ink' : 'text-ink-muted'}>{step.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
