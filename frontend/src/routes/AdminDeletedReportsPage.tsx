import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDeletedReports, restoreReport } from '../lib/reports-api';
import { Button } from '../components/ui/Button';
import { CATEGORY_LABELS } from '../lib/labels';
import { useToast } from '../lib/toast-context';
import type { ReportListItem } from '../types/domain';

function DeletedReportRow({ report }: { report: ReportListItem }) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const restoreMutation = useMutation({
    mutationFn: () => restoreReport(report.id),
    onSuccess: () => {
      show('Report restored.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deleted-reports'] });
    },
    onError: () => show("Couldn't restore this report. Please try again.", 'error'),
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading truncate text-[14.5px] font-bold">{CATEGORY_LABELS[report.category]}</span>
          <span className="bg-status-critical/10 text-status-critical rounded-full px-2 py-0.5 text-[11px] font-semibold">
            Deleted {report.deleted_at ? new Date(report.deleted_at).toLocaleDateString() : ''}
          </span>
        </div>
        <p className="text-ink-secondary truncate text-[12.5px]">{report.description}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => restoreMutation.mutate()}
        disabled={restoreMutation.isPending}
      >
        {restoreMutation.isPending ? 'Restoring…' : 'Restore'}
      </Button>
    </div>
  );
}

export function AdminDeletedReportsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'deleted-reports', search, page],
    queryFn: () => fetchDeletedReports({ search: search || undefined, page }),
  });

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Deleted reports</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Search</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Description, department, officer"
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {isError && (
        <p className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          Couldn't load deleted reports. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">No deleted reports.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((report) => (
            <DeletedReportRow key={report.id} report={report} />
          ))}
        </div>
      )}

      {data && (data.next || data.previous) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-ink-muted text-xs">Page {page}</span>
          <Button variant="ghost" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
