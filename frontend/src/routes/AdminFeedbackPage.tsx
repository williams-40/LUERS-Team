import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllFeedback } from '../lib/reports-api';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export function AdminFeedbackPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'feedback', page],
    queryFn: () => fetchAllFeedback(page),
  });

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl">Reporter feedback</h1>
        {data && (
          <span className="text-ink-muted text-sm">{data.count} submission{data.count === 1 ? '' : 's'}</span>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {isError && (
        <p className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          Couldn't load feedback. Please try again.
        </p>
      )}

      {data && data.results.length === 0 && <p className="text-ink-secondary text-sm">No feedback submitted yet.</p>}

      {data && data.results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.results.map((feedback) => (
            <div key={feedback.id} className="rounded-xl border border-ink/10 px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Link to={`/reports/${feedback.report_id}`} className="text-brand text-sm font-semibold hover:underline">
                  {feedback.department_name ?? 'Report'} · {feedback.report_id.slice(0, 8).toUpperCase()}
                </Link>
                <span className="text-accent-yellow text-sm" aria-label={`${feedback.rating} out of 5 stars`}>
                  {'★'.repeat(feedback.rating)}
                  <span className="text-ink/15">{'★'.repeat(5 - feedback.rating)}</span>
                </span>
              </div>
              {feedback.comments && <p className="text-ink-secondary text-[12.5px]">{feedback.comments}</p>}
              <p className="text-ink-muted mt-1 text-xs">
                {feedback.submitted_by_username ?? 'Reporter'} · {new Date(feedback.created_at).toLocaleString()}
              </p>
            </div>
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
