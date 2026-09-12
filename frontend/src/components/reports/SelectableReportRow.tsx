import { ReportCard } from '../ReportCard';
import type { ReportListItem } from '../../types/domain';

export function SelectableReportRow({
  report,
  selected,
  onToggle,
}: {
  report: ReportListItem;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(report.id)}
        aria-label={`Select report ${report.id.slice(0, 8).toUpperCase()}`}
        className="accent-brand mt-4 h-4 w-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <ReportCard report={report} />
      </div>
    </div>
  );
}
