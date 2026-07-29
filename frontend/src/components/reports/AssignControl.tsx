import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { assignReport, fetchOfficers } from '../../lib/reports-api';
import type { ReportDetail } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';

export function AssignControl({
  report,
  onUpdated,
}: {
  report: ReportDetail;
  onUpdated: () => void | Promise<unknown>;
}) {
  const [selected, setSelected] = useState<string>(report.assigned_to ?? '');
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: officers, isLoading: officersLoading } = useQuery({
    queryKey: ['officers'],
    queryFn: fetchOfficers,
  });

  const mutation = useMutation({
    mutationFn: () =>
      assignReport({ reportId: report.id, assignedTo: selected, expectedUpdatedAt: report.updated_at }),
  });

  async function handleSubmit() {
    setError(null);
    setConflict(false);
    try {
      await mutation.mutateAsync();
      await onUpdated();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409) {
        setConflict(true);
      } else {
        setError(apiError.detail ?? 'Could not assign this report.');
      }
    }
  }

  async function handleRefresh() {
    setConflict(false);
    await onUpdated();
  }

  return (
    <div className="mb-5 rounded-xl border border-black/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Assign officer</h2>

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
          onChange={(e) => setSelected(e.target.value)}
          disabled={officersLoading}
          className="rounded-lg border-[1.5px] border-black/15 px-2.5 py-1.5 text-sm"
        >
          <option value="" disabled>
            {officersLoading ? 'Loading officers…' : 'Select an officer'}
          </option>
          {officers?.map((officer) => (
            <option key={officer.id} value={officer.id}>
              {officer.username}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={mutation.isPending || !selected || selected === report.assigned_to}
        >
          {mutation.isPending ? 'Assigning…' : 'Assign'}
        </Button>
      </div>
    </div>
  );
}
