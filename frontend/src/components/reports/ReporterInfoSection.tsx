import { useState } from 'react';
import type { ReportDetail } from '../../types/domain';
import { Button } from '../ui/Button';

/**
 * Rendered to a responder actually handling the report (see
 * ReportDetailPage's canUpdateStatus gate) — anonymous reporting was
 * removed, so reporter identity is always known once a report exists.
 */
export function ReporterInfoSection({ report }: { report: ReportDetail }) {
  const [expanded, setExpanded] = useState(false);

  if (!report.reporter_name) return null;

  return (
    <div className="mb-5 rounded-xl border border-ink/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ink-secondary text-[12.5px] font-semibold">Reporter information</h2>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide' : 'Show'}
        </Button>
      </div>
      {expanded && (
        <div className="mt-2 text-sm">
          <p>
            <span className="font-semibold">Name:</span> {report.reporter_name}
          </p>
          <p>
            <span className="font-semibold">Phone:</span> {report.reporter_phone ?? 'Not on file'}
          </p>
        </div>
      )}
    </div>
  );
}
