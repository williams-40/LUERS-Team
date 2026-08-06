import { useMutation, useQuery } from '@tanstack/react-query';
import { acknowledgeAssistance } from '../../lib/reports-api';
import { fetchDepartments } from '../../lib/departments-api';
import type { AssistanceRequest } from '../../types/domain';
import type { ApiError } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../lib/toast-context';

export function AssistanceRequestsList({
  assistanceRequests,
  onUpdated,
}: {
  assistanceRequests: AssistanceRequest[];
  onUpdated: () => void | Promise<unknown>;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const { data: departments } = useQuery({
    queryKey: ['departments', { is_active: true, myMemberships: true }],
    queryFn: () => fetchDepartments({ is_active: true }),
  });

  const mutation = useMutation({
    mutationFn: (args: { assistanceRequestId: string; departmentId: string }) => acknowledgeAssistance(args),
  });

  async function handleAcknowledge(assistanceRequestId: string, departmentId: string) {
    try {
      await mutation.mutateAsync({ assistanceRequestId, departmentId });
      show('Acknowledged. The requester has been notified.', 'success');
      await onUpdated();
    } catch (err) {
      const apiError = err as ApiError;
      show(apiError.detail ?? 'Could not acknowledge this request.', 'error');
    }
  }

  if (assistanceRequests.length === 0) return null;

  function isMyDepartment(departmentId: string) {
    if (!user || !departments) return false;
    const department = departments.results.find((d) => d.id === departmentId);
    return Boolean(department && (department.head === user.id || department.members.includes(user.id)));
  }

  return (
    <div className="mb-5">
      <h2 className="text-ink-secondary mb-2 text-[12.5px] font-semibold">
        Assistance requests ({assistanceRequests.length})
      </h2>
      <ul className="flex flex-col gap-2.5">
        {assistanceRequests.map((request) => (
          <li key={request.id} className="rounded-xl border border-ink/10 p-3">
            <p className="text-sm">
              <span className="font-semibold">{request.requested_by_username ?? 'Someone'}</span> asked{' '}
              {request.departments.map((d) => d.name).join(', ')} for help — "{request.reason}"
            </p>
            <p className="text-ink-muted mt-1 text-xs">{new Date(request.created_at).toLocaleString()}</p>

            <ul className="mt-2 flex flex-col gap-1.5">
              {request.departments.map((department) => {
                const acknowledgement = request.acknowledgements.find((a) => a.department === department.id);
                return (
                  <li key={department.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-secondary">{department.name}</span>
                    {acknowledgement ? (
                      <span className="text-status-good-ink">
                        Acknowledged by {acknowledgement.acknowledged_by_username ?? 'someone'}
                      </span>
                    ) : isMyDepartment(department.id) ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAcknowledge(request.id, department.id)}
                        disabled={mutation.isPending}
                      >
                        Acknowledge
                      </Button>
                    ) : (
                      <span className="text-ink-muted">Awaiting response</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
