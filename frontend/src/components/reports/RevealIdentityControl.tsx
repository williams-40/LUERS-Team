import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { revealIdentity } from '../../lib/reports-api';
import type { RevealedIdentity } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';

export function RevealIdentityControl({ reportId }: { reportId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState<RevealedIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => revealIdentity(reportId),
  });

  async function handleReveal() {
    setError(null);
    try {
      const identity = await mutation.mutateAsync();
      setRevealed(identity);
      setConfirming(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(
        apiError.status === 404
          ? 'No identity record exists for this report.'
          : (apiError.detail ?? 'Could not reveal the reporter identity.'),
      );
      setConfirming(false);
    }
  }

  return (
    <div className="border-status-warning/40 mb-5 rounded-xl border p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Reporter identity (Escrow)</h2>

      {error && (
        <p
          role="alert"
          className="bg-status-critical/10 text-status-critical mb-3 rounded-lg px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {revealed ? (
        <div className="text-sm">
          <p>
            <span className="font-semibold">Username:</span> {revealed.username}
          </p>
          <p>
            <span className="font-semibold">Email:</span> {revealed.email}
          </p>
          {revealed.university_id && (
            <p>
              <span className="font-semibold">University ID:</span> {revealed.university_id}
            </p>
          )}
          <p className="text-ink-muted mt-2 text-xs">This reveal has been recorded in the audit log.</p>
        </div>
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-ink-secondary text-sm">
            This will decrypt the reporter's identity and log the action. Continue?
          </p>
          <Button size="sm" variant="destructive" onClick={handleReveal} disabled={mutation.isPending}>
            {mutation.isPending ? 'Revealing…' : 'Confirm reveal'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Reveal reporter identity
        </Button>
      )}
    </div>
  );
}
