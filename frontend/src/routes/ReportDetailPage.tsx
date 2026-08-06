import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteReport, fetchReportDetail } from '../lib/reports-api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatusUpdateControl } from '../components/reports/StatusUpdateControl';
import { AssignControl } from '../components/reports/AssignControl';
import { TransferControl } from '../components/reports/TransferControl';
import { EscalateControl } from '../components/reports/EscalateControl';
import { RequestAssistanceControl } from '../components/reports/RequestAssistanceControl';
import { AssistanceRequestsList } from '../components/reports/AssistanceRequestsList';
import { FeedbackDisplay } from '../components/reports/FeedbackDisplay';
import { RevealIdentityControl } from '../components/reports/RevealIdentityControl';
import { ReportChat } from '../components/reports/ReportChat';
import { LiveIndicator } from '../components/ui/LiveIndicator';
import { Button } from '../components/ui/Button';
import { CATEGORY_LABELS } from '../lib/labels';
import { Urgency } from '../types/domain';
import type { ReportDetail, RoutingSuggestion } from '../types/domain';
import type { ApiError } from '../lib/api-client';
import type { ChatMessagePayload } from '../lib/ws-client';
import { useAuth } from '../hooks/useAuth';
import { useReportSocket } from '../hooks/useReportSocket';
import { useToast } from '../lib/toast-context';

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
    try {
      await deleteMutation.mutateAsync();
      show('Report deleted.', 'success');
      navigate('/admin');
    } catch (err) {
      const apiError = err as ApiError;
      show(apiError.detail ?? 'Could not delete this report.', 'error');
    }
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

  // Phase 14: assign/transfer authority is "this report's department
  // head, or System Admin" — not a fixed Role list, since responders are
  // department members now, regardless of account role. Escalation is
  // head-only (System Admin escalating to themselves is meaningless).
  const isDepartmentHead = Boolean(user && report.department_head_id === user.id);
  const isSystemAdmin = Boolean(user?.permissions.includes('view_all_reports'));
  const canManageDepartment = isDepartmentHead || isSystemAdmin;
  const isAssignedResponder = Boolean(user && report.assigned_to === user.id);
  const canUpdateStatus = isAssignedResponder || canManageDepartment;
  const routingSuggestion = report.metadata.routing_suggestion as RoutingSuggestion | undefined;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      {justCreated && (
        <div className="bg-status-good/10 text-status-good-ink mb-5 rounded-xl px-4 py-3 text-sm font-semibold">
          Report submitted{report.is_anonymous ? ' anonymously' : ''}. You'll see status updates here.
        </div>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl">
          {report.department_name ?? (report.category ? CATEGORY_LABELS[report.category] : 'Report')}
        </h1>
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

      {report.category_display && (
        <p className="text-ink-muted mb-5 text-xs">Legacy category: {report.category_display}</p>
      )}

      {report.assigned_to_username && (
        <p className="text-ink-secondary mb-5 text-sm">
          <span className="font-semibold">Assigned to:</span> {report.assigned_to_username}
        </p>
      )}

      {routingSuggestion && canManageDepartment && (
        <p className="bg-status-warning/10 mb-5 rounded-lg px-3 py-2 text-sm">
          <span className="font-semibold">Suggested department:</span> {routingSuggestion.suggested_department} (
          {Math.round(routingSuggestion.confidence * 100)}% confidence) — matched:{' '}
          {routingSuggestion.matched_keywords.join(', ')}
        </p>
      )}

      <FeedbackDisplay reportId={report.id} />

      {canUpdateStatus && <StatusUpdateControl report={report} onUpdated={refetch} />}

      {canManageDepartment && <AssignControl report={report} onUpdated={refetch} />}

      {canManageDepartment && <TransferControl report={report} onUpdated={refetch} />}

      {isDepartmentHead && <EscalateControl report={report} />}

      {canUpdateStatus && <RequestAssistanceControl report={report} onUpdated={refetch} />}

      <AssistanceRequestsList assistanceRequests={report.assistance_requests} onUpdated={refetch} />

      {user?.permissions.includes('reveal_identity') && <RevealIdentityControl reportId={report.id} />}

      {user?.permissions.includes('delete_report') && (
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
              <li key={item.id} className="rounded-lg bg-ink/4 px-3 py-1.5 text-sm">
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
        to={user?.permissions.includes('view_admin_dashboard') ? '/admin' : '/reports/mine'}
        className="text-brand text-sm font-semibold hover:underline"
      >
        {user?.permissions.includes('view_admin_dashboard') ? 'Back to queue' : 'Back to my reports'}
      </Link>
    </div>
  );
}
