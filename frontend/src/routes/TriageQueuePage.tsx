import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReportQueue } from '../hooks/useReportQueue';
import type { QueueFilterState } from '../hooks/useReportQueue';
import { useReportSocket } from '../hooks/useReportSocket';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SelectableReportRow } from '../components/reports/SelectableReportRow';
import { BulkActionToolbar } from '../components/reports/BulkActionToolbar';
import { ReportCardSkeleton } from '../components/reports/ReportCardSkeleton';
import { Button } from '../components/ui/Button';
import { LiveIndicator } from '../components/ui/LiveIndicator';
import { Category, Status, Urgency } from '../types/domain';
import type { BulkActionResponse } from '../lib/reports-api';
import { CATEGORY_LABELS } from '../lib/labels';
import { downloadReportsExport, bulkUpdateStatus, bulkAssignReports } from '../lib/reports-api';
import { fetchDepartments } from '../lib/departments-api';
import { useToast } from '../lib/toast-context';

const STATUS_OPTIONS = Object.values(Status);
const CATEGORY_OPTIONS = Object.values(Category);
const URGENCY_OPTIONS = Object.values(Urgency);
const LIVE_REFRESH_DEBOUNCE_MS = 400;

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
        className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
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
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const queueFilters: QueueFilterState = { ...filters, search: debouncedSearch || undefined };
  const { data, isLoading, isError, page, setPage, refresh, isFetching } = useReportQueue(queueFilters);
  const { data: departments } = useQuery({
    queryKey: ['departments', { is_active: true, filter: true }],
    queryFn: () => fetchDepartments({ is_active: true }),
  });

  // Debounced, delta-fetch refresh instead of inserting the raw WS payload
  // directly (that used to bypass department/assignment scoping entirely
  // — a live report_created/report_updated event would show full report
  // data for reports outside the viewer's now-scoped access). refresh()
  // already does a real scoped REST call.
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLiveRefresh = useCallback(() => {
    if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current);
    liveRefreshTimer.current = setTimeout(() => void refresh(), LIVE_REFRESH_DEBOUNCE_MS);
  }, [refresh]);
  const { status: socketStatus, reconnect } = useReportSocket({
    onReportCreated: scheduleLiveRefresh,
    onReportUpdated: scheduleLiveRefresh,
  });
  const toast = useToast();

  // Selection shouldn't silently carry across a re-filter/page change — the
  // officer could otherwise bulk-act on a report they can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.category, filters.urgency, filters.department, debouncedSearch, page]);

  function setFilter<K extends keyof QueueFilterState>(key: K, value: QueueFilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleExport(exportFormat: 'csv' | 'pdf') {
    setExporting(exportFormat);
    try {
      await downloadReportsExport(queueFilters, exportFormat);
    } finally {
      setExporting(null);
    }
  }

  function reportBulkResults(response: BulkActionResponse) {
    const successCount = response.results.filter((r) => r.status === 'success').length;
    const failCount = response.results.length - successCount;
    if (failCount === 0) {
      toast.show(`Updated ${successCount} report${successCount === 1 ? '' : 's'}.`, 'success');
    } else if (successCount === 0) {
      toast.show(`Couldn't update any of the ${failCount} selected reports.`, 'error');
    } else {
      toast.show(`Updated ${successCount} report${successCount === 1 ? '' : 's'}, ${failCount} failed.`, 'error');
    }
  }

  async function handleBulkStatus(newStatus: Status) {
    setBulkBusy(true);
    try {
      const response = await bulkUpdateStatus(Array.from(selectedIds), newStatus);
      reportBulkResults(response);
      clearSelection();
      await refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkAssign(officerId: string) {
    setBulkBusy(true);
    try {
      const response = await bulkAssignReports(Array.from(selectedIds), officerId);
      reportBulkResults(response);
      clearSelection();
      await refresh();
    } finally {
      setBulkBusy(false);
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
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Search</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Description, department, officer…"
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          />
        </label>
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
        <FilterSelect
          label="Department"
          value={filters.department}
          onChange={(v) => setFilter('department', v)}
          options={(departments?.results ?? []).map((d) => d.id)}
          labelFor={(id) => departments?.results.find((d) => d.id === id)?.name ?? id}
        />
      </div>

      <BulkActionToolbar
        count={selectedIds.size}
        onBulkStatus={handleBulkStatus}
        onBulkAssign={handleBulkAssign}
        onClear={clearSelection}
        busy={bulkBusy}
      />

      {isLoading && (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }, (_, i) => (
            <ReportCardSkeleton key={i} />
          ))}
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
            <SelectableReportRow
              key={report.id}
              report={report}
              selected={selectedIds.has(report.id)}
              onToggle={toggleSelected}
            />
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
