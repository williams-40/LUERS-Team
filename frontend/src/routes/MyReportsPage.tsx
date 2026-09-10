import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchMyReports } from '../lib/reports-api';
import { ReportCard } from '../components/ReportCard';
import { Button } from '../components/ui/Button';

export function MyReportsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'mine'],
    queryFn: fetchMyReports,
  });

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl">My reports</h1>
        <Link to="/emergency">
          <Button variant="secondary" size="sm">
            New report
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {isError && (
        <p className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          Couldn't load your reports. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && (
        <p className="text-ink-secondary text-sm">You haven't submitted any reports yet.</p>
      )}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
