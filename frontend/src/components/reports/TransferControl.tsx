import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { transferReportDepartment } from '../../lib/reports-api';
import type { ReportDetail } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { DepartmentPicker } from './DepartmentPicker';

/**
 * For routine re-routing corrections ("this actually belongs to ICT, not
 * us") — distinct from EscalateControl, which is for exceptional
 * situations needing System Admin intervention, not routine corrections.
 */
export function TransferControl({
  report,
  onUpdated,
}: {
  report: ReportDetail;
  onUpdated: () => void | Promise<unknown>;
}) {
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      transferReportDepartment({ reportId: report.id, departmentId: departmentId!, reason: reason.trim() || undefined }),
  });

  async function handleSubmit() {
    if (!departmentId) return;
    setError(null);
    try {
      await mutation.mutateAsync();
      setReason('');
      setDepartmentId(undefined);
      await onUpdated();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail ?? 'Could not transfer this report.');
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Transfer department</h2>
      <p className="text-ink-muted mb-3 text-xs">
        Moves the report to a different department and clears its current assignment.
      </p>

      {error && (
        <p role="alert" className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <DepartmentPicker value={departmentId} onChange={setDepartmentId} />

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        rows={2}
        className="focus:outline-brand mt-3 w-full rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm outline-2 outline-offset-1 focus:border-transparent"
      />

      <Button size="sm" className="mt-3" onClick={handleSubmit} disabled={mutation.isPending || !departmentId}>
        {mutation.isPending ? 'Transferring…' : 'Transfer'}
      </Button>
    </div>
  );
}
