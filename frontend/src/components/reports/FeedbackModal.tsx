import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { submitFeedback } from '../../lib/reports-api';
import type { ReportListItem } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../../lib/toast-context';
import { cn } from '../../lib/utils';

const STAR_VALUES = [1, 2, 3, 4, 5];

export function FeedbackModal({
  report,
  onSubmitted,
  onDismiss,
  onViewReport,
}: {
  report: ReportListItem;
  onSubmitted: () => void;
  onDismiss: () => void;
  onViewReport: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  const mutation = useMutation({
    mutationFn: () => submitFeedback({ reportId: report.id, rating, comments: comments.trim() || undefined }),
  });

  async function handleSubmit() {
    if (rating === 0) return;
    setError(null);
    try {
      await mutation.mutateAsync();
      show('Thanks for your feedback. The report has been closed.', 'success');
      onSubmitted();
    } catch (err) {
      const apiError = err as ApiError;
      const message = apiError.detail ?? 'Could not submit feedback.';
      setError(message);
      show(message, 'error');
    }
  }

  const shortId = report.id.slice(0, 8).toUpperCase();

  return (
    <Modal title="How did we do?" onClose={onDismiss}>
      <p className="text-ink mb-1 text-sm font-semibold">Report #{shortId} has been marked as Resolved.</p>
      <p className="text-ink-muted mb-3 text-sm">
        Your feedback helps us improve the quality of emergency response services provided by the university.
      </p>
      <Link
        to={`/reports/${report.id}`}
        onClick={onViewReport}
        className="text-brand mb-4 inline-block text-sm font-semibold hover:underline"
      >
        View report
      </Link>

      {error && (
        <p role="alert" className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="mb-3 flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
        {STAR_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            onClick={() => setRating(value)}
            className={cn(
              'text-3xl leading-none transition',
              value <= rating ? 'text-accent-yellow' : 'text-ink/15 hover:text-ink/30',
            )}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Tell us about your experience (optional)"
        rows={3}
        className="focus:outline-brand w-full rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm outline-2 outline-offset-1 focus:border-transparent"
      />

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Remind me later
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending || rating === 0}>
          {mutation.isPending ? 'Submitting…' : 'Submit feedback'}
        </Button>
      </div>
    </Modal>
  );
}
