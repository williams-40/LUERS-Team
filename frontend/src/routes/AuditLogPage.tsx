import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLog, downloadAuditLogExport } from '../lib/audit-api';
import type { AuditLogFilters } from '../lib/audit-api';
import { Button } from '../components/ui/Button';
import { Action } from '../types/domain';
import type { AuditLogEntry } from '../types/domain';
import { ACTION_LABELS } from '../lib/labels';

const ACTION_OPTIONS = Object.values(Action);

function AuditLogEntryRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasState = entry.before_state || entry.after_state;

  return (
    <div className="rounded-xl border border-ink/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="bg-brand/10 text-brand rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {entry.action_display}
          </span>
          <span className="text-ink text-sm">{entry.actor_username ?? 'Unknown actor'}</span>
          {entry.report && (
            <Link
              to={`/reports/${entry.report}`}
              className="text-brand font-mono text-[11px] hover:underline"
            >
              {entry.report.slice(0, 8).toUpperCase()}
            </Link>
          )}
        </div>
        <span className="text-ink-muted text-xs">{new Date(entry.created_at).toLocaleString()}</span>
      </div>

      <div className="text-ink-muted mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px]">
        {entry.ip_address && <span>{entry.ip_address}</span>}
        <span>{entry.sync_origin_display}</span>
        {hasState && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-brand font-semibold">
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>

      {expanded && hasState && (
        <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          {entry.before_state && (
            <div>
              <p className="text-ink-muted mb-0.5 font-semibold uppercase">Before</p>
              <pre className="overflow-x-auto rounded-lg bg-ink/4 p-2">
                {JSON.stringify(entry.before_state, null, 2)}
              </pre>
            </div>
          )}
          {entry.after_state && (
            <div>
              <p className="text-ink-muted mb-0.5 font-semibold uppercase">After</p>
              <pre className="overflow-x-auto rounded-lg bg-ink/4 p-2">
                {JSON.stringify(entry.after_state, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogPage() {
  const [filters, setFilters] = useState<Omit<AuditLogFilters, 'page'>>({});
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => fetchAuditLog({ ...filters, page }),
  });

  function setFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  }

  async function handleExport(format: 'csv' | 'pdf') {
    setExporting(format);
    try {
      await downloadAuditLogExport(filters, format);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Audit log</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('csv')} disabled={exporting !== null}>
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">Action</span>
          <select
            value={filters.action ?? ''}
            onChange={(e) => setFilter('action', (e.target.value || undefined) as Action | undefined)}
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          >
            <option value="">All</option>
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">From</span>
          <input
            type="date"
            value={filters.date_from?.slice(0, 10) ?? ''}
            onChange={(e) => setFilter('date_from', e.target.value || undefined)}
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-ink-secondary font-semibold">To</span>
          <input
            type="date"
            value={filters.date_to?.slice(0, 10) ?? ''}
            onChange={(e) => setFilter('date_to', e.target.value || undefined)}
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
          Couldn't load the audit log. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">No audit entries match these filters.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((entry) => (
            <AuditLogEntryRow key={entry.id} entry={entry} />
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
