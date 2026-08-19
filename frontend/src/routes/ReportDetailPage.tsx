import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteReport, fetchReportDetail } from '../lib/reports-api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatusUpdateControl } from '../components/reports/StatusUpdateControl';
import { AssignControl } from '../components/reports/AssignControl';
import { FeedbackDisplay } from '../components/reports/FeedbackDisplay';
import { ReporterInfoSection } from '../components/reports/ReporterInfoSection';
import { ReportLocationMap } from '../components/reports/ReportLocationMap';
import { EmergencyStatusChecklist } from '../components/reports/EmergencyStatusChecklist';
import { EmergencyActionsControl } from '../components/reports/EmergencyActionsControl';
import { ReportChat } from '../components/reports/ReportChat';
import { LiveIndicator } from '../components/ui/LiveIndicator';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
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
  const queueHref = user?.permissions.includes('view_admin_dashboard') ? '/admin' : '/reports/mine';
  const queueLabel = user?.permissions.includes('view_admin_dashboard') ? 'Report queue' : 'My reports';
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteMutation = useMutation({ mutationFn: () => deleteReport(id!) });

  async function handleDelete() {
    setConfirmingDelete(false);
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
      <div className="mx-auto max-w-xl px-5 py-16">
        <ErrorState
          title={
            error.status === 403
              ? "You don't have access to this report."
              : error.status === 404
                ? 'Report not found.'
                : 'Something went wrong loading this report.'
          }
          action={
            <Link to="/" className="text-brand text-sm font-semibold hover:underline">
              Back home
            </Link>
          }
        />
      </div>
    );
  }

  if (!report) return null;

  // Assign/update-status are hands-on operational actions. Assignment
  // stays the department head's call (or System Admin's, who is
  // oversight-only otherwise). Status updates are narrower still
  // (2026-08-17): only the assigned responder, who's actually the one in
  // the field — not even the department head, who monitors/reassigns but
  // doesn't do the work themselves. isSystemAdmin still gates purely
  // informational sections (reporter info, routing suggestion) since
  // admin oversight still means full visibility, just no actions.
  const isDepartmentHead = Boolean(user && report.department_head_id === user.id);
  const isSystemAdmin = Boolean(user?.permissions.includes('view_all_reports'));
  const isAssignedResponder = Boolean(user && report.assigned_to === user.id);
  const canViewOperationalDetails = isAssignedResponder || isDepartmentHead || isSystemAdmin;
  const canUpdateStatus = isAssignedResponder;
  const canAssign = isDepartmentHead;
  const routingSuggestion = report.metadata.routing_suggestion as RoutingSuggestion | undefined;
  const title = report.department_name ?? (report.category ? CATEGORY_LABELS[report.category] : 'Report');
  const hasActions = report.urgency === Urgency.PANIC || canUpdateStatus || canAssign || user?.permissions.includes('delete_report');

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Breadcrumbs items={[{ label: queueLabel, to: queueHref }, { label: `Report #${report.id.slice(0, 8).toUpperCase()}` }]} />

      {justCreated && (
        <div className="bg-status-good/10 text-status-good-ink mb-5 rounded-xl px-4 py-3 text-sm font-semibold">
          Report submitted. You'll see status updates here.
        </div>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl">{title}</h1>
        <div className="flex items-center gap-2">
          <LiveIndicator status={socketStatus} onReconnect={reconnect} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      <p className="text-ink-muted mb-5 font-mono text-xs">
        {report.id.slice(0, 8).toUpperCase()} · {new Date(report.created_at).toLocaleString()}
        {report.urgency === Urgency.PANIC && <span className="text-status-critical font-sans"> · Panic</span>}
      </p>

      {report.urgency === Urgency.PANIC && (
        <div className="mb-5">
          <EmergencyStatusChecklist report={report} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main column — the report itself: what happened, evidence, feedback */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            {report.description && (
              <p className="text-ink mb-3 text-sm leading-relaxed whitespace-pre-wrap">{report.description}</p>
            )}
            {report.category_display && (
              <p className="text-ink-muted text-xs">Legacy category: {report.category_display}</p>
            )}
            {report.assigned_to_username && (
              <p className="text-ink-secondary mt-2 text-sm">
                <span className="font-semibold">Assigned to:</span> {report.assigned_to_username}
              </p>
            )}
            {routingSuggestion && canViewOperationalDetails && (
              <p className="bg-status-warning/10 mt-3 rounded-lg px-3 py-2 text-sm">
                <span className="font-semibold">Suggested department:</span> {routingSuggestion.suggested_department} (
                {Math.round(routingSuggestion.confidence * 100)}% confidence), matched:{' '}
                {routingSuggestion.matched_keywords.join(', ')}
              </p>
            )}
          </Card>

          {report.evidence.length > 0 && (
            <Card>
              <h2 className="text-ink-secondary mb-2 text-[12.5px] font-semibold">
                Evidence ({report.evidence.length})
              </h2>
              <ul className="flex flex-col gap-1.5">
                {report.evidence.map((item) => (
                  <li key={item.id} className="rounded-lg bg-ink/4 px-3 py-1.5 text-sm">
                    {item.file_url ? (
                      <a href={item.file_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        {item.file_type} evidence
                      </a>
                    ) : (
                      <span className="text-ink-muted">{item.file_type} evidence</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <FeedbackDisplay reportId={report.id} />

          {canViewOperationalDetails && <ReporterInfoSection report={report} />}
        </div>

        {/* Sidebar — where it happened and what to do about it */}
        <div className="flex flex-col gap-5">
          <ReportLocationMap
            latitude={report.latitude}
            longitude={report.longitude}
            locationAccuracy={report.location_accuracy}
          />

          {hasActions && (
            <Card className="flex flex-col gap-4">
              <h2 className="text-ink-secondary text-[12.5px] font-semibold">Actions</h2>

              {report.urgency === Urgency.PANIC && (
                <EmergencyActionsControl report={report} onUpdated={refetch} />
              )}

              {canUpdateStatus && <StatusUpdateControl report={report} onUpdated={refetch} />}

              {canAssign && <AssignControl report={report} onUpdated={refetch} />}

              {user?.permissions.includes('delete_report') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleteMutation.isPending}
                  className="self-start"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete report'}
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>

      <div className="mt-5">
        <ReportChat
          reportId={report.id}
          liveMessages={liveMessages}
          onSend={sendChatMessage}
          canSend={socketStatus === 'open'}
        />
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this report?"
          description="It will be removed from the queue and can be restored by an admin later."
          confirmLabel="Delete"
          destructive
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
