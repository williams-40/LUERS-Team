import { useQuery } from '@tanstack/react-query';
import { fetchReportQueue } from '../lib/reports-api';
import { ReportCard } from '../components/ReportCard';

/**
 * System Admin's view of reports a department head manually escalated to
 * them (EmergencyActionsControl's "Escalate to System Admin"), reached from
 * the dashboard's EscalatedReportsPanel. Scoped server-side the same way as
 * that panel's preview — active reports with a manual EMERGENCY_ESCALATED
 * audit entry — just without the 5-item cap.
 */
export function EscalatedReportsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'queue', 'escalated-full'],
    queryFn: () => fetchReportQueue({ escalated_to_admin: true, active: true }),
  });

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">Escalated to you</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        Reports a department head escalated to System Admin, with a reason, and hasn't resolved yet.
      </p>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {isError && (
        <p className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          Couldn't load escalated reports. Please try again.
        </p>
      )}

      {data && data.page.results.length === 0 && (
        <p className="text-ink-secondary text-sm">Nothing currently escalated to you.</p>
      )}

      {data && data.page.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.page.results.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
