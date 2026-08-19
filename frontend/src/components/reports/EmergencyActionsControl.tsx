import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  acknowledgeEmergency,
  respondToEmergency,
  arriveAtEmergency,
  cancelEmergency,
  escalateEmergency,
} from '../../lib/reports-api';
import { Status } from '../../types/domain';
import type { ReportDetail } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../lib/toast-context';

/**
 * Responder/head lifecycle actions for a panic report — acknowledge,
 * respond, arrive, cancel/false-alarm, escalate. Each button only renders
 * when the viewer could plausibly be allowed to take that action; the
 * backend re-checks authorization independently either way (see
 * EmergencyAcknowledgeView etc. — this is UI convenience, not the real gate).
 */
export function EmergencyActionsControl({
  report,
  onUpdated,
}: {
  report: ReportDetail;
  onUpdated: () => void | Promise<unknown>;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  const acknowledgeMutation = useMutation({ mutationFn: () => acknowledgeEmergency(report.id) });
  const respondMutation = useMutation({ mutationFn: () => respondToEmergency(report.id) });
  const arriveMutation = useMutation({ mutationFn: () => arriveAtEmergency(report.id) });
  const cancelMutation = useMutation({
    mutationFn: (reason: 'cancelled' | 'false_alarm') => cancelEmergency(report.id, reason),
  });
  const escalateMutation = useMutation({
    mutationFn: (reason: string) => escalateEmergency(report.id, reason),
  });

  const anyPending =
    acknowledgeMutation.isPending ||
    respondMutation.isPending ||
    arriveMutation.isPending ||
    cancelMutation.isPending ||
    escalateMutation.isPending;

  async function handleError(err: unknown) {
    const apiError = err as ApiError;
    const message = apiError.detail ?? 'Something went wrong.';
    setError(message);
    show(message, 'error');
  }

  async function handleAcknowledge() {
    setError(null);
    try {
      await acknowledgeMutation.mutateAsync();
      show('Acknowledged. You are now the assigned responder.', 'success');
      await onUpdated();
    } catch (err) {
      await handleError(err);
    }
  }

  async function handleRespond() {
    setError(null);
    try {
      await respondMutation.mutateAsync();
      show('Marked as responding.', 'success');
      await onUpdated();
    } catch (err) {
      await handleError(err);
    }
  }

  async function handleArrive() {
    setError(null);
    try {
      await arriveMutation.mutateAsync();
      show('Marked as arrived.', 'success');
      await onUpdated();
    } catch (err) {
      await handleError(err);
    }
  }

  async function handleCancel(reason: 'cancelled' | 'false_alarm') {
    setError(null);
    try {
      await cancelMutation.mutateAsync(reason);
      show(reason === 'false_alarm' ? 'Marked as a false alarm.' : 'Emergency cancelled.', 'success');
      await onUpdated();
    } catch (err) {
      await handleError(err);
    }
  }

  async function handleEscalate() {
    if (!escalateReason.trim()) return;
    setError(null);
    try {
      await escalateMutation.mutateAsync(escalateReason.trim());
      show('Escalated to System Admin.', 'success');
      setShowEscalateForm(false);
      setEscalateReason('');
      await onUpdated();
    } catch (err) {
      await handleError(err);
    }
  }

  const dispatch = report.emergency_dispatch;
  if (!dispatch || !user) return null;

  const isAssignedResponder = report.assigned_to === user.id;
  const isDepartmentHead = report.department_head_id === user.id;
  const isSystemAdmin = user.permissions.includes('view_all_reports');
  const isHeadOrAdmin = isDepartmentHead || isSystemAdmin;
  const isReporter = report.reporter === user.id;

  const isActive =
    report.status === Status.NEW || report.status === Status.ACKNOWLEDGED || report.status === Status.IN_PROGRESS;
  // The reporter isn't a department member/responder and can't actually
  // acknowledge their own emergency (the backend rejects it) — keep their
  // available actions limited to cancel/false alarm rather than showing a
  // button that only errors for them.
  const canAcknowledge = isActive && !dispatch.acknowledged_at && !isReporter;
  const canRespond = isAssignedResponder && report.status === Status.ACKNOWLEDGED && !dispatch.responding_at;
  const canArrive = isAssignedResponder && report.status === Status.IN_PROGRESS && !dispatch.arrived_at;
  const canCancel =
    isHeadOrAdmin || (isReporter && (report.status === Status.NEW || report.status === Status.ACKNOWLEDGED));
  // System Admin is the top of the chain — there's nowhere for them to
  // escalate to, so only the department head gets this action, and never
  // the reporter (who isn't part of the response at all).
  const canEscalate = isDepartmentHead && !isReporter && isActive;

  if (!canAcknowledge && !canRespond && !canArrive && !canCancel && !canEscalate) return null;

  return (
    <div className="mb-5 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Emergency actions</h2>

      {error && (
        <p role="alert" className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canAcknowledge && (
          <Button size="sm" disabled={anyPending} onClick={() => void handleAcknowledge()}>
            Acknowledge
          </Button>
        )}
        {canRespond && (
          <Button size="sm" disabled={anyPending} onClick={() => void handleRespond()}>
            Mark responding
          </Button>
        )}
        {canArrive && (
          <Button size="sm" disabled={anyPending} onClick={() => void handleArrive()}>
            Mark arrived
          </Button>
        )}
        {canCancel && (
          <>
            <Button size="sm" variant="ghost" disabled={anyPending} onClick={() => void handleCancel('false_alarm')}>
              False alarm
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={anyPending}
              onClick={() => void handleCancel('cancelled')}
            >
              Cancel
            </Button>
          </>
        )}
        {canEscalate && !showEscalateForm && (
          <Button size="sm" variant="secondary" disabled={anyPending} onClick={() => setShowEscalateForm(true)}>
            Escalate to System Admin
          </Button>
        )}
      </div>

      {canEscalate && showEscalateForm && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-ink/10 p-2.5">
          <label htmlFor="escalate-reason" className="text-ink-secondary text-[12px] font-semibold">
            Reason for escalating to System Admin
          </label>
          <textarea
            id="escalate-reason"
            rows={2}
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder="Why does System Admin need to step in?"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-2.5 py-2 text-sm outline-2 outline-offset-1 focus:border-transparent"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={anyPending || !escalateReason.trim()}
              onClick={() => void handleEscalate()}
            >
              {escalateMutation.isPending ? 'Escalating…' : 'Confirm escalation'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={anyPending}
              onClick={() => {
                setShowEscalateForm(false);
                setEscalateReason('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
