import { useQuery } from '@tanstack/react-query';
import { fetchReportFeedback } from '../../lib/reports-api';
import type { ApiError } from '../../lib/api-client';
import type { ReportFeedback } from '../../types/domain';

/** Shown on ReportDetailPage once a report has feedback — visible to anyone with report access (department head/member/assigned responder/System Admin, or the reporter themselves). 404 (no feedback yet) is expected and renders nothing. */
export function FeedbackDisplay({ reportId }: { reportId: string }) {
  const { data, error } = useQuery<ReportFeedback, ApiError>({
    queryKey: ['reports', reportId, 'feedback'],
    queryFn: () => fetchReportFeedback(reportId),
    retry: false,
  });

  if (error || !data) return null;

  return (
    <div className="bg-status-good/8 mb-5 rounded-xl border border-ink/10 p-4">
      <h2 className="text-ink-secondary mb-2 text-[12.5px] font-semibold">Reporter feedback</h2>
      <span className="text-accent-yellow text-lg" aria-label={`${data.rating} out of 5 stars`}>
        {'★'.repeat(data.rating)}
        <span className="text-ink/15">{'★'.repeat(5 - data.rating)}</span>
      </span>
      {data.comments && <p className="text-ink-secondary mt-1.5 text-sm">{data.comments}</p>}
      <p className="text-ink-muted mt-2 text-xs">
        {data.submitted_by_username ?? 'Reporter'} · {new Date(data.created_at).toLocaleString()}
      </p>
    </div>
  );
}
