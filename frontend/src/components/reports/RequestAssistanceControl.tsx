import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { requestAssistance } from '../../lib/reports-api';
import type { ReportDetail } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { DepartmentMultiSelect } from './DepartmentMultiSelect';
import { useToast } from '../../lib/toast-context';

/**
 * Pulls in one or more other departments to help on a report while the
 * requester's own department keeps ownership — distinct from
 * TransferControl (moves ownership) and EscalateControl (flags for System
 * Admin only, no department picker).
 */
export function RequestAssistanceControl({
  report,
  onUpdated,
}: {
  report: ReportDetail;
  onUpdated: () => void | Promise<unknown>;
}) {
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  const mutation = useMutation({
    mutationFn: () => requestAssistance({ reportId: report.id, departmentIds, reason: reason.trim() }),
  });

  async function handleSubmit() {
    if (departmentIds.length === 0 || !reason.trim()) return;
    setError(null);
    try {
      await mutation.mutateAsync();
      show('Assistance requested. The selected department(s) have been notified.', 'success');
      setReason('');
      setDepartmentIds([]);
      await onUpdated();
    } catch (err) {
      const apiError = err as ApiError;
      const message = apiError.detail ?? 'Could not request assistance.';
      setError(message);
      show(message, 'error');
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Request assistance</h2>
      <p className="text-ink-muted mb-3 text-xs">
        Ask other departments for help on this report — you keep ownership; they gain visibility into it.
      </p>

      {error && (
        <p role="alert" className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <DepartmentMultiSelect value={departmentIds} onChange={setDepartmentIds} />

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for requesting assistance (required)"
        rows={2}
        className="focus:outline-brand mt-3 w-full rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm outline-2 outline-offset-1 focus:border-transparent"
      />

      <Button
        size="sm"
        className="mt-3"
        onClick={handleSubmit}
        disabled={mutation.isPending || departmentIds.length === 0 || !reason.trim()}
      >
        {mutation.isPending ? 'Requesting…' : 'Request assistance'}
      </Button>
    </div>
  );
}
