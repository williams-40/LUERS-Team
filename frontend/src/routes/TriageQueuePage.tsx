import { useState } from 'react';
import { useReportQueue } from '../hooks/useReportQueue';
import type { QueueFilterState } from '../hooks/useReportQueue';
import { useReportSocket } from '../hooks/useReportSocket';
import { ReportCard } from '../components/ReportCard';
import { Button } from '../components/ui/Button';
import { LiveIndicator } from '../components/ui/LiveIndicator';
import { Category, Status, Urgency } from '../types/domain';
import { CATEGORY_LABELS } from '../lib/labels';
import { downloadReportsExport } from '../lib/reports-api';

const STATUS_OPTIONS = Object.values(Status);
const CATEGORY_OPTIONS = Object.values(Category);
const URGENCY_OPTIONS = Object.values(Urgency);

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  labelFor,
}: {
  label: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: T[];
  labelFor: (option: T) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px]">
      <span className="text-ink-secondary font-semibold">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
        className="rounded-lg border-[1.5px] border-black/15 px-2.5 py-1.5 text-sm"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TriageQueuePage() {
  const [filters, setFilters] = useState<QueueFilterState>({});
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const { data, isLoading, isError, page, setPage, refresh, isFetching, applyLiveEvent } =
    useReportQueue(filters);
  const { status: socketStatus, reconnect } = useReportSocket({
    onReportCreated: applyLiveEvent,
    onReportUpdated: applyLiveEvent,
  });

  function setFilter<K extends keyof QueueFilterState>(key: K, value: QueueFilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleExport(exportFormat: 'csv' | 'pdf') {
    setExporting(exportFormat);
    try {
      await downloadReportsExport(filters, exportFormat);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl">Report queue</h1>
          <LiveIndicator status={socketStatus} onReconnect={reconnect} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('csv')} disabled={exporting !== null}>
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={STATUS_OPTIONS}
          labelFor={(s) => s.replace('_', ' ')}
        />
        <FilterSelect
          label="Category"
          value={filters.category}
          onChange={(v) => setFilter('category', v)}
          options={CATEGORY_OPTIONS}
          labelFor={(c) => CATEGORY_LABELS[c]}
        />
        <FilterSelect
          label="Urgency"
          value={filters.urgency}
          onChange={(v) => setFilter('urgency', v)}
          options={URGENCY_OPTIONS}
          labelFor={(u) => u}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {isError && (
        <p className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          Couldn't load the queue. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">No reports match these filters.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {data && (data.next || data.previous) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={!data.previous} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-ink-muted text-xs">Page {page}</span>
          <Button variant="ghost" size="sm" disabled={!data.next} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
