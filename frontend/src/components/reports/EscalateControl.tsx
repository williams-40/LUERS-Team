import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { escalateReport } from '../../lib/reports-api';
import type { ReportDetail } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';

/**
 * For genuinely exceptional situations needing System Admin intervention
 * — NOT for routine department-routing corrections, which use
 * TransferControl instead.
 */
export function EscalateControl({ report }: { report: ReportDetail }) {
  const [reason, setReason] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => escalateReport({ reportId: report.id, reason: reason.trim() || undefined }),
  });

  async function handleSubmit() {
    setError(null);
    try {
      await mutation.mutateAsync();
      setEscalated(true);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail ?? 'Could not escalate this report.');
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Escalate to System Admin</h2>
      <p className="text-ink-muted mb-3 text-xs">For exceptional situations only — not routine routing corrections.</p>

      {error && (
        <p role="alert" className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {escalated && !error && (
        <p role="status" className="bg-status-good/10 text-status-good-ink mb-3 rounded-lg px-3 py-2 text-sm">
          Escalated. System Admins have been notified.
        </p>
      )}

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        rows={2}
        className="focus:outline-brand w-full rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm outline-2 outline-offset-1 focus:border-transparent"
      />

      <Button size="sm" variant="secondary" className="mt-3" onClick={handleSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? 'Escalating…' : 'Escalate'}
      </Button>
    </div>
  );
}
