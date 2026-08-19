import { Status } from '../../types/domain';
import type { ReportDetail } from '../../types/domain';
import { cn } from '../../lib/utils';

const STEPS = [
  { key: 'received', label: 'Emergency received' },
  { key: 'notified', label: 'Response team notified' },
  { key: 'acknowledged', label: 'Responder acknowledged' },
  { key: 'responding', label: 'Responder on the way' },
  { key: 'arrived', label: 'Responder arrived' },
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

  const done: Record<(typeof STEPS)[number]['key'], boolean> = {
    received: true,
    // Multi-channel dispatch (WebSocket + SMS + email) always fires on
    // panic creation — see ReportService.create_report.
    notified: true,
    acknowledged: Boolean(dispatch.acknowledged_at),
    responding: Boolean(dispatch.responding_at),
    arrived: Boolean(dispatch.arrived_at),
    resolved: Boolean(dispatch.resolved_at) || report.status === Status.RESOLVED || report.status === Status.CLOSED,
  };

  return (
    <div className="border-status-critical/30 bg-status-critical/5 mb-5 rounded-xl border px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-status-critical font-heading text-[13px] font-extrabold tracking-wide uppercase">
          {isCancelled ? 'Emergency cancelled' : isFalseAlarm ? 'Marked as false alarm' : 'Emergency active'}
        </span>
        {dispatch.escalation_level > 0 && (
          <span className="bg-status-critical rounded-full px-2 py-0.5 text-[11px] font-bold text-white">
            Escalated ×{dispatch.escalation_level}
          </span>
        )}
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
