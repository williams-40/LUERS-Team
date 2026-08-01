import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteReport, fetchReportDetail } from '../lib/reports-api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatusUpdateControl } from '../components/reports/StatusUpdateControl';
import { AssignControl } from '../components/reports/AssignControl';
import { RevealIdentityControl } from '../components/reports/RevealIdentityControl';
import { ReportChat } from '../components/reports/ReportChat';
import { LiveIndicator } from '../components/ui/LiveIndicator';
import { Button } from '../components/ui/Button';
import { CATEGORY_LABELS } from '../lib/labels';
import { ACCOUNT_ADMIN_ROLES, ADMIN_ROLES, Role, Urgency } from '../types/domain';
import type { ReportDetail } from '../types/domain';
import type { ApiError } from '../lib/api-client';
import type { ChatMessagePayload } from '../lib/ws-client';
import { useAuth } from '../hooks/useAuth';
import { useReportSocket } from '../hooks/useReportSocket';
import { useToast } from '../lib/toast-context';

const ASSIGN_ROLES: Role[] = [Role.SECURITY, Role.ICT_ADMIN];

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);

  const deleteMutation = useMutation({ mutationFn: () => deleteReport(id!) });

  async function handleDelete() {
    if (!window.confirm('Delete this report? It will be removed from the queue and can be restored by an admin later.')) {
      return;
    }
    await deleteMutation.mutateAsync();
    show('Report deleted.', 'success');
    navigate('/admin');
  }

  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useQuery<ReportDetail, ApiError>({
    queryKey: ['reports', id],
    queryFn: () => fetchReportDetail(id!),
    enabled: Boolean(id),
  });

  const [liveMessages, setLiveMessages] = useState<ChatMessagePayload[]>([]);
  useEffect(() => setLiveMessages([]), [id]);

  const { status: socketStatus, sendChatMessage, reconnect } = useReportSocket({
    reportId: id,
    onReportUpdated: (updated) => {
      if (updated.id === id) void refetch();
    },
    onChatMessage: (message) => setLiveMessages((prev) => [...prev, message]),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <p className="text-status-critical text-sm">
          {error.status === 403
            ? "You don't have access to this report."
            : error.status === 404
              ? 'Report not found.'
              : 'Something went wrong loading this report.'}
        </p>
        <Link to="/" className="text-brand mt-3 inline-block text-sm font-semibold hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      {justCreated && (
        <div className="bg-status-good/10 mb-5 rounded-xl px-4 py-3 text-sm font-semibold text-[#0a6b0a]">
          Report submitted{report.is_anonymous ? ' anonymously' : ''}. You'll see status updates here.
        </div>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl">{CATEGORY_LABELS[report.category]}</h1>
        <div className="flex items-center gap-2">
          <LiveIndicator status={socketStatus} onReconnect={reconnect} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      <p className="text-ink-muted mb-4 font-mono text-xs">
        {report.id.slice(0, 8).toUpperCase()} · {new Date(report.created_at).toLocaleString()}
        {report.urgency === Urgency.PANIC && <span className="text-status-critical font-sans"> · Panic</span>}
      </p>

      <p className="text-ink mb-5 text-sm leading-relaxed whitespace-pre-wrap">{report.description}</p>

      {report.department_name && (
        <p className="text-ink-secondary mb-5 text-sm">
          <span className="font-semibold">Routed to:</span> {report.department_name}
        </p>
      )}

      {report.assigned_to_username && (
        <p className="text-ink-secondary mb-5 text-sm">
          <span className="font-semibold">Assigned to:</span> {report.assigned_to_username}
        </p>
      )}

      {user?.role === Role.SECURITY && <StatusUpdateControl report={report} onUpdated={refetch} />}

      {user && ASSIGN_ROLES.includes(user.role) && <AssignControl report={report} onUpdated={refetch} />}

      {user?.role === Role.MANAGEMENT && <RevealIdentityControl reportId={report.id} />}

      {user && ACCOUNT_ADMIN_ROLES.includes(user.role) && (
        <div className="mb-5">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? 'Deleting…' : 'Delete report'}
          </Button>
        </div>
      )}

      {report.evidence.length > 0 && (
        <div className="mb-5">
          <h2 className="text-ink-secondary mb-2 text-[12.5px] font-semibold">
            Evidence ({report.evidence.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {report.evidence.map((item) => (
              <li key={item.id} className="rounded-lg bg-black/4 px-3 py-1.5 text-sm">
                {item.file_url ? (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {item.file_type} evidence
                  </a>
                ) : (
                  <span className="text-ink-muted">{item.file_type} evidence</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ReportChat
        reportId={report.id}
        liveMessages={liveMessages}
        onSend={sendChatMessage}
        canSend={socketStatus === 'open'}
      />

      <Link
        to={user && ADMIN_ROLES.includes(user.role) ? '/admin' : '/reports/mine'}
        className="text-brand text-sm font-semibold hover:underline"
      >
        {user && ADMIN_ROLES.includes(user.role) ? 'Back to queue' : 'Back to my reports'}
      </Link>
    </div>
  );
}
