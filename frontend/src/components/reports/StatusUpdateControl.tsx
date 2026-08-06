import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateReportStatus } from '../../lib/reports-api';
import { Status } from '../../types/domain';
import type { ReportDetail } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { useToast } from '../../lib/toast-context';

const STATUS_OPTIONS = Object.values(Status);

export function StatusUpdateControl({
  report,
  onUpdated,
}: {
  report: ReportDetail;
  onUpdated: () => void | Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Status>(report.status);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      updateReportStatus({ reportId: report.id, status: selected, expectedUpdatedAt: report.updated_at }),
  });

  async function handleSubmit() {
    setError(null);
    setConflict(false);
    try {
      await mutation.mutateAsync();
      show(`Status updated to ${selected.replace('_', ' ')}.`, 'success');
      await onUpdated();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409) {
        setConflict(true);
        show('This report changed since you loaded it — refresh and try again.', 'error');
      } else {
        const message = apiError.detail ?? 'Could not update status.';
        setError(message);
        show(message, 'error');
      }
    }
  }

  async function handleRefresh() {
    setConflict(false);
    await onUpdated();
  }

  return (
    <div className="mb-5 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Update status</h2>

      {conflict && (
        <div role="alert" className="bg-status-warning/15 mb-3 rounded-lg px-3 py-2 text-sm">
          This report changed since you loaded it.{' '}
          <button type="button" onClick={handleRefresh} className="font-semibold underline">
            Refresh
          </button>{' '}
          to see the latest, then try again.
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as Status)}
          className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.replace('_', ' ')}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending || selected === report.status}>
          {mutation.isPending ? 'Updating…' : 'Update'}
        </Button>
      </div>
    </div>
  );
}
