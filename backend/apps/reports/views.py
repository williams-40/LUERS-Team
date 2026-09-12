from datetime import datetime
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db.models import Q, Case, When, Value, IntegerField
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from django_ratelimit.core import is_ratelimited
from django_ratelimit.exceptions import Ratelimited
from apps.reports.models import Report, Evidence, Department
from apps.reports.serializers import (
    ReportListSerializer, ReportDetailSerializer, ReportCreateSerializer,
    ReportUpdateStatusSerializer, ReportAssignSerializer, EvidenceSerializer,
    ReportLocationUpdateSerializer,
)
from apps.reports.services import (
    ReportService, MessageService, EmergencyDispatchService, get_accessible_reports, filter_reports,
    is_department_head_or_system_admin, is_report_department_head, is_department_member_or_head, can_upload_evidence,
    can_view_panic_report, get_open_report_counts,
)
from apps.notifications.services import NotificationService
from apps.reports.validators import validate_evidence_file
from apps.accounts.permissions import IsStudentOrStaff, IsAdminTier, CanDeleteReport
from apps.core.export import csv_response, pdf_response
from apps.core.pagination import StandardPagination
from reportlab.lib.units import inch
from apps.reports.serializers import SyncRequestSerializer, SyncResultSerializer
from rest_framework.exceptions import ValidationError as DRFValidationError
from apps.core.choices import SyncOrigin, Status
from apps.core.request_utils import get_client_ip, get_user_agent


class ReportCreateView(generics.CreateAPIView):
    """
    POST /api/v1/reports/
    Submit a report (panic or detailed).

    Rate limit is split by urgency, in two independent django_ratelimit
    groups, so exhausting the normal-report quota can never block a real
    emergency: 5/h per user for normal reports (unchanged from before this
    split), 10/h per user for panic reports (still abuse-resistant, just
    more generous, since a burst of real emergencies from one account is a
    lot more plausible than a burst of routine reports).
    """
    serializer_class = ReportCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudentOrStaff]

    def post(self, request, *args, **kwargs):
        is_panic = request.data.get('urgency') == 'panic'
        group = 'report-create-panic' if is_panic else 'report-create-normal'
        rate = '10/h' if is_panic else '5/h'
        if is_ratelimited(request, group=group, key='user', rate=rate, method='POST', increment=True):
            raise Ratelimited()
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        ip = get_client_ip(self.request)
        ua = get_user_agent(self.request)
        report = ReportService.create_report(
            validated_data=serializer.validated_data,
            user=self.request.user,
            ip_address=ip,
            user_agent=ua,
            sync_origin=SyncOrigin.LIVE
        )
        serializer.instance = report


class ReportListView(generics.ListAPIView):
    """
    GET /api/v1/reports/
    List reports with filtering by status, category, urgency, and since (delta-fetch).
    Access is department-aware: users see reports based on their role and department membership.
    """
    serializer_class = ReportListSerializer
    permission_classes = [permissions.IsAuthenticated]  # ✅ changed to allow all authenticated users
    pagination_class = StandardPagination

    def get_queryset(self):
        user = self.request.user
        queryset = get_accessible_reports(user)  # ✅ department-aware filtering
        queryset = filter_reports(queryset, self.request.query_params)

        # Delta-fetch: filter by updated_at > since
        since = self.request.query_params.get('since')
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                if timezone.is_naive(since_dt):
                    since_dt = timezone.make_aware(since_dt)
                queryset = queryset.filter(updated_at__gt=since_dt)
            except ValueError:
                pass

        # Open panic reports first, then newest-first within each tier —
        # a panic report no longer waits its turn behind older routine
        # tickets. Only applied when the caller hasn't asked for a specific
        # ordering (none of this view's callers currently do).
        queryset = queryset.annotate(
            _priority=Case(
                When(Q(urgency='panic') & ~Q(status__in=['resolved', 'closed', 'cancelled', 'false_alarm']), then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        )
        return queryset.order_by('_priority', '-created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        queryset = self.filter_queryset(self.get_queryset())
        if queryset.exists():
            latest = queryset.latest('updated_at')
            response['X-Cursor'] = latest.updated_at.isoformat()
        else:
            response['X-Cursor'] = timezone.now().isoformat()

        return response


class ReportExportView(APIView):
    """
    GET /api/v1/reports/export/?export_format=csv|pdf&status=&category=&urgency=
    Exports the caller's accessible reports (same status/category/urgency
    filters as the queue list), respecting department-aware access.
    Admin tier only.

    Uses 'export_format' rather than DRF's reserved 'format' query param —
    DRF's content negotiation intercepts 'format' for its own renderer
    selection and raises Http404 for values it doesn't recognize (like
    'csv'), before the view body ever runs.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminTier]

    HEADER = [
        'ID', 'Category', 'Status', 'Urgency', 'Reporter', 'Department',
        'Assigned To', 'Evidence Count', 'Created At', 'Updated At',
    ]

    # Proportioned to fit the ~9.6in usable width of a landscape-letter PDF
    # page (see apps.core.export.pdf_response) so columns don't get cropped.
    PDF_COL_WIDTHS = [
        0.7 * inch, 1.1 * inch, 0.9 * inch, 0.8 * inch, 1.1 * inch,
        1.2 * inch, 1.1 * inch, 0.7 * inch, 1.0 * inch, 1.0 * inch,
    ]

    def get(self, request):
        queryset = get_accessible_reports(request.user)
        queryset = filter_reports(queryset, request.query_params)
        queryset = queryset.select_related('department', 'assigned_to', 'reporter').prefetch_related('evidence').order_by('-created_at')

        export_format = request.query_params.get('export_format', 'csv')
        if export_format == 'pdf':
            # Truncated ID/timestamps to keep columns narrow enough to fit
            # the page without cropping (full detail stays in the CSV export).
            rows = [
                [
                    str(r.id)[:8],
                    r.category,
                    r.status,
                    r.urgency,
                    r.reporter.username if r.reporter else '',
                    r.department.name if r.department else '',
                    r.assigned_to.username if r.assigned_to else '',
                    len(r.evidence.all()),
                    r.created_at.strftime('%Y-%m-%d %H:%M'),
                    r.updated_at.strftime('%Y-%m-%d %H:%M'),
                ]
                for r in queryset
            ]
            return pdf_response('Reports', self.HEADER, rows, 'reports.pdf', col_widths=self.PDF_COL_WIDTHS)

        rows = [
            [
                str(r.id),
                r.category,
                r.status,
                r.urgency,
                r.reporter.username if r.reporter else '',
                r.department.name if r.department else '',
                r.assigned_to.username if r.assigned_to else '',
                len(r.evidence.all()),
                r.created_at.isoformat(),
                r.updated_at.isoformat(),
            ]
            for r in queryset
        ]
        return csv_response(self.HEADER, rows, 'reports.csv')


class ReportDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/reports/{id}/
    Report detail with department-aware access control.
    """
    queryset = Report.objects.all()
    serializer_class = ReportDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_object(self):
        obj = super().get_object()
        if can_view_panic_report(self.request.user, obj):
            return obj
        raise PermissionDenied("You do not have access to this report.")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ReportStatusUpdateView(APIView):
    """
    PATCH /api/v1/reports/{id}/status/
    Update report status — only the responder it's assigned to, no one
    else, including its department head or System Admin. Heads assign and
    monitor; the assigned responder is the one actually in the field, so
    they're the only one who marks progress. Deliberately narrower than
    "can view" (get_accessible_reports): the report's own reporter, its
    department head, and System Admin can all see it, but none of them
    may change its status — the frontend already only ever shows this
    control to the assigned responder (ReportDetailPage.tsx's
    canUpdateStatus); Phase 5 first closed the matching backend gap for
    reporters, and this closes it for heads/system_admin too, so the
    restriction isn't frontend-only for any of them.
    Supports conflict detection via expected_updated_at.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportUpdateStatusSerializer

    def patch(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if report.assigned_to_id != request.user.id:
            raise PermissionDenied("Only this report's assigned responder can update its status.")
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        expected_updated_at = serializer.validated_data.get('expected_updated_at')
        client_timestamp = serializer.validated_data.get('client_timestamp')

        ip = get_client_ip(request)
        ua = get_user_agent(request)
        result = ReportService.update_status(
            report,
            new_status,
            request.user,
            ip_address=ip,
            user_agent=ua,
            expected_updated_at=expected_updated_at,
            client_timestamp=client_timestamp,
            sync_origin=SyncOrigin.LIVE
        )

        if 'error' in result:
            return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': result['status']})


class ReportLocationUpdateView(APIView):
    """
    PATCH /api/v1/reports/{id}/location/
    The /emergency flow never awaits geolocation before submitting — this
    lets the client send coordinates afterward, once they resolve. Reporter
    only, and only while the report doesn't already have a location (no
    silently overwriting a location that came in some other way).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportLocationUpdateSerializer

    def patch(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if report.reporter_id != request.user.id:
            raise PermissionDenied("Only this report's reporter can update its location.")
        if report.latitude is not None:
            raise DRFValidationError({'error': 'This report already has a location.'})

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        report.latitude = serializer.validated_data['latitude']
        report.longitude = serializer.validated_data['longitude']
        report.location_accuracy = serializer.validated_data.get('location_accuracy')
        report.save(update_fields=['latitude', 'longitude', 'location_accuracy', 'updated_at'])

        transaction.on_commit(lambda: NotificationService.broadcast_report_updated(report))
        return Response({
            'latitude': report.latitude, 'longitude': report.longitude,
            'location_accuracy': report.location_accuracy,
        })


class ReportAssignView(APIView):
    """
    POST /api/v1/reports/{id}/assign/
    Assign (or reassign) a report to a responder within its own
    department. Only that department's Head, or System Admin, may do
    this — a plain responder can't self-assign or assign others, and a
    head can't reach into another department's report at all (the
    get_accessible_reports() lookup below already 404s it for them).
    Supports conflict detection via expected_updated_at.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportAssignSerializer

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if not is_department_head_or_system_admin(request.user, report):
            raise PermissionDenied("Only this report's department head or a System Admin can assign it.")

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        assigned_to = serializer.validated_data['assigned_to']
        if not is_department_member_or_head(assigned_to, report.department):
            raise DRFValidationError({'assigned_to': "This user is not a member of the report's department."})

        expected_updated_at = serializer.validated_data.get('expected_updated_at')
        client_timestamp = serializer.validated_data.get('client_timestamp')

        ip = get_client_ip(request)
        ua = get_user_agent(request)
        result = ReportService.assign_report(
            report,
            assigned_to,
            request.user,
            ip_address=ip,
            user_agent=ua,
            expected_updated_at=expected_updated_at,
            client_timestamp=client_timestamp,
            sync_origin=SyncOrigin.LIVE
        )
        return Response({'assigned_to': result['assigned_to']})


class EmergencyAcknowledgeView(APIView):
    """
    POST /api/v1/reports/{id}/acknowledge/
    Any member or head of a panic report's department can acknowledge it —
    "first to acknowledge claims it": if nobody is assigned yet, the
    acknowledging user becomes the assigned responder (reuses the existing
    single-FK assigned_to; a head can still reassign afterward via /assign/).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        # Deliberately not scoped through get_accessible_reports: an
        # unassigned department member has no other reason to be able to
        # *view* an arbitrary report yet, but must still be able to find
        # and claim one that was just dispatched to their department.
        # is_department_member_or_head is the real authorization check here.
        report = get_object_or_404(Report.objects.filter(deleted_at__isnull=True), id=id)
        if not is_department_member_or_head(request.user, report.department):
            raise PermissionDenied("Only this report's department can acknowledge it.")
        dispatch = EmergencyDispatchService.acknowledge(
            report, request.user, ip_address=get_client_ip(request), user_agent=get_user_agent(request),
        )
        return Response({'acknowledged_at': dispatch.acknowledged_at, 'assigned_to': str(report.assigned_to_id)})


class EmergencyRespondView(APIView):
    """
    POST /api/v1/reports/{id}/respond/
    Only the report's assigned responder — same rule as status-PATCH.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if report.assigned_to_id != request.user.id:
            raise PermissionDenied("Only this report's assigned responder can mark it as responding.")
        dispatch = EmergencyDispatchService.respond(
            report, request.user, ip_address=get_client_ip(request), user_agent=get_user_agent(request),
        )
        return Response({'responding_at': dispatch.responding_at})


class EmergencyArriveView(APIView):
    """
    POST /api/v1/reports/{id}/arrive/
    Only the report's assigned responder.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if report.assigned_to_id != request.user.id:
            raise PermissionDenied("Only this report's assigned responder can mark it as arrived.")
        dispatch = EmergencyDispatchService.arrive(
            report, request.user, ip_address=get_client_ip(request), user_agent=get_user_agent(request),
        )
        return Response({'arrived_at': dispatch.arrived_at})


class EmergencyCancelView(APIView):
    """
    POST /api/v1/reports/{id}/cancel/  { "reason": "cancelled" | "false_alarm" }
    The reporter can cancel their own panic report, but only before a
    responder is actively en route (status new/acknowledged) — covers an
    accidental tap. The department head or System Admin can cancel at any
    stage. Never deletes the row — soft, same as every other report state.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        reason = request.data.get('reason')
        if reason not in ('cancelled', 'false_alarm'):
            raise DRFValidationError({'reason': "Must be 'cancelled' or 'false_alarm'."})

        is_head_or_admin = is_department_head_or_system_admin(request.user, report)
        is_reporter_pre_dispatch = (
            report.reporter_id == request.user.id and report.status in (Status.NEW, Status.ACKNOWLEDGED)
        )
        if not (is_head_or_admin or is_reporter_pre_dispatch):
            raise PermissionDenied(
                "Only the reporter (before a responder is dispatched), this report's department head, "
                "or a System Admin can cancel it."
            )

        dispatch = EmergencyDispatchService.cancel(
            report, request.user, reason, ip_address=get_client_ip(request), user_agent=get_user_agent(request),
        )
        return Response({'cancelled_at': dispatch.cancelled_at, 'status': report.status})


class EmergencyEscalateView(APIView):
    """
    POST /api/v1/reports/{id}/escalate/  { "reason": "..." }
    Manual escalation by the report's own department head only — System
    Admin is the top of the chain and has nowhere to escalate *to*, so
    they don't get this action. Always goes straight to System Admin and
    always requires a reason (validated in the service layer). The same
    underlying action also fires automatically from the Celery Beat SLA
    scanner (apps.reports.tasks.check_emergency_escalations) when nobody
    escalates it manually in time — that automatic path is unaffected.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if not is_report_department_head(request.user, report):
            raise PermissionDenied("Only this report's department head can escalate it.")
        reason = request.data.get('reason')
        if not isinstance(reason, str) or not reason.strip():
            raise DRFValidationError({'reason': 'A reason is required to escalate to System Admin.'})
        dispatch = EmergencyDispatchService.escalate(
            report, actor=request.user, reason=reason,
            ip_address=get_client_ip(request), user_agent=get_user_agent(request),
        )
        return Response({'escalation_level': dispatch.escalation_level})


class ReportAssignableOfficersView(APIView):
    """
    GET /api/v1/reports/{id}/assignable-officers/
    Returns the report's department head + members — the pool a head (or
    System Admin) can assign the report to. Replaces the old unscoped
    `/auth/officers/` (all security officers, campus-wide) for this
    purpose now that responders are department-scoped, not role-scoped.

    Each candidate also carries `open_report_count` (2026-08-17) — how
    many currently-open reports they're already assigned, within
    whatever this caller can see (get_open_report_counts) — so the head
    can tell who's free before assigning. Informational only: nothing
    here blocks assigning an already-busy responder, that's a deliberate
    call left to the head, not a server-side rule.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if not is_department_head_or_system_admin(request.user, report):
            raise PermissionDenied("Only this report's department head or a System Admin can view its assignable officers.")

        department = report.department
        if department is None:
            return Response([])

        # A system admin is oversight-only and is never eligible to be
        # assigned as a responder, even if stale data somehow still lists
        # one as a member/head (see serializers_department.py's own
        # rejection of this on write).
        candidates = list(department.members.exclude(role__slug='system_admin'))
        if department.head and department.head.role.slug != 'system_admin' and department.head not in candidates:
            candidates.append(department.head)

        open_counts = get_open_report_counts(
            get_accessible_reports(request.user), [u.id for u in candidates],
        )
        return Response([
            {'id': str(u.id), 'username': u.username, 'open_report_count': open_counts.get(u.id, 0)}
            for u in candidates
        ])


class EvidenceUploadView(APIView):
    """
    POST /api/v1/reports/{id}/evidence/
    Upload evidence file. Validates extension, size, and that the file's
    content actually matches its claimed extension (magic-byte sniffing).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EvidenceSerializer

    def post(self, request, id):
        report = get_object_or_404(Report, id=id)
        user = request.user
        if not can_upload_evidence(user, report):
            raise PermissionDenied("You do not have permission to upload evidence for this report.")

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_type = validate_evidence_file(file)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        ip = get_client_ip(request)
        ua = get_user_agent(request)
        evidence = ReportService.add_evidence(
            report,
            file,
            file_type,
            user,
            ip_address=ip,
            user_agent=ua,
            sync_origin=SyncOrigin.LIVE
        )
        serializer = self.serializer_class(evidence, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReportDeleteView(APIView):
    """
    POST /api/v1/reports/{id}/delete/
    Soft-deletes a report (sets deleted_at) — excludes it from the triage
    queue, dashboards, search, and every reporter's own view, but keeps the
    row (and its Evidence) intact until purge_deleted_reports hard-deletes
    it after the retention window. Account-admin only.
    """
    permission_classes = [permissions.IsAuthenticated, CanDeleteReport]

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        ip = get_client_ip(request)
        ua = get_user_agent(request)
        ReportService.soft_delete(report, request.user, ip_address=ip, user_agent=ua, sync_origin=SyncOrigin.LIVE)
        return Response({'id': str(report.id), 'deleted_at': report.deleted_at})


class ReportRestoreView(APIView):
    """
    POST /api/v1/reports/{id}/restore/
    Clears deleted_at on a soft-deleted report. Account-admin only.
    """
    permission_classes = [permissions.IsAuthenticated, CanDeleteReport]

    def post(self, request, id):
        report = get_object_or_404(
            get_accessible_reports(request.user, include_deleted=True).filter(deleted_at__isnull=False),
            id=id,
        )
        ip = get_client_ip(request)
        ua = get_user_agent(request)
        ReportService.restore(report, request.user, ip_address=ip, user_agent=ua, sync_origin=SyncOrigin.LIVE)
        return Response({'id': str(report.id), 'deleted_at': None})


class ReportPermanentDeleteView(APIView):
    """
    POST /api/v1/reports/{id}/delete/permanent/
    Irreversibly deletes a report that's already been soft-deleted — only
    reachable from the Deleted reports admin view, never straight from an
    active report. Same System-Admin-only gate as soft-delete/restore
    (delete_report is already effectively system_admin-only — see
    test_soft_delete.py). Rejects a report that isn't soft-deleted yet,
    so this can never be used to skip the soft-delete step.
    """
    permission_classes = [permissions.IsAuthenticated, CanDeleteReport]

    def post(self, request, id):
        report = get_object_or_404(
            get_accessible_reports(request.user, include_deleted=True).filter(deleted_at__isnull=False),
            id=id,
        )
        ip = get_client_ip(request)
        ua = get_user_agent(request)
        ReportService.permanent_delete(report, request.user, ip_address=ip, user_agent=ua)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportDeletedListView(generics.ListAPIView):
    """
    GET /api/v1/reports/deleted/
    Lists soft-deleted reports (deleted_at set) so an admin can review and
    restore them. Without this endpoint, soft-delete would be write-only.
    Account-admin only.
    """
    serializer_class = ReportListSerializer
    permission_classes = [permissions.IsAuthenticated, CanDeleteReport]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = get_accessible_reports(self.request.user, include_deleted=True).filter(deleted_at__isnull=False)
        queryset = filter_reports(queryset, self.request.query_params)
        return queryset.order_by('-deleted_at')


class MyReportsView(generics.ListAPIView):
    """
    GET /api/v1/reports/mine/
    """
    serializer_class = ReportListSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudentOrStaff]

    def get_queryset(self):
        from apps.reports.services import get_accessible_reports
        return get_accessible_reports(self.request.user).order_by('-created_at')


class SyncView(APIView):
    """
    POST /api/v1/sync/
    Accepts a batch of offline actions and processes them atomically (or each independently).
    Supports:
      - create_report
      - update_status
      - send_message
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sync_serializer = SyncRequestSerializer(data=request.data)
        sync_serializer.is_valid(raise_exception=True)
        actions = sync_serializer.validated_data['actions']

        results = []

        for action_data in actions:
            action_type = action_data['action']
            idempotency_key = action_data.get('idempotency_key')
            client_created_at = action_data.get('client_created_at')
            data = action_data['data']
            report_id = action_data.get('report_id')
            ip = get_client_ip(request)
            ua = get_user_agent(request)

            try:
                if action_type == 'create_report':
                    if not IsStudentOrStaff().has_permission(request, None):
                        raise PermissionDenied("Only students and staff can create reports")

                    create_data = data.copy()
                    if idempotency_key:
                        create_data['idempotency_key'] = idempotency_key
                    if client_created_at:
                        create_data['client_created_at'] = client_created_at

                    from apps.reports.serializers import ReportCreateSerializer
                    report_serializer = ReportCreateSerializer(data=create_data, context={'request': request})
                    report_serializer.is_valid(raise_exception=True)
                    report = ReportService.create_report(
                        validated_data=report_serializer.validated_data,
                        user=request.user,
                        ip_address=ip,
                        user_agent=ua,
                        sync_origin=SyncOrigin.SYNC
                    )
                    detail_serializer = ReportDetailSerializer(report, context={'request': request})
                    results.append({
                        'action': action_type,
                        'status': 'success',
                        'data': detail_serializer.data
                    })

                elif action_type == 'update_status':
                    try:
                        report = get_accessible_reports(request.user).get(id=report_id)
                    except Report.DoesNotExist:
                        raise DRFValidationError(f"Report with id {report_id} not found")

                    new_status = data.get('status')
                    expected_updated_at = data.get('expected_updated_at')
                    client_timestamp = data.get('client_timestamp')
                    if not new_status:
                        raise DRFValidationError("Missing 'status' for update_status")

                    result = ReportService.update_status(
                        report,
                        new_status,
                        request.user,
                        ip_address=ip,
                        user_agent=ua,
                        expected_updated_at=expected_updated_at,
                        client_timestamp=client_timestamp,
                        sync_origin=SyncOrigin.SYNC
                    )
                    if 'error' in result:
                        raise DRFValidationError(result['error'])

                    detail_serializer = ReportDetailSerializer(report, context={'request': request})
                    results.append({
                        'action': action_type,
                        'status': 'success',
                        'data': detail_serializer.data
                    })

                elif action_type == 'send_message':
                    content = data.get('content')
                    if not content:
                        raise DRFValidationError("Missing 'content' for send_message")

                    try:
                        report = Report.objects.get(id=report_id)
                    except Report.DoesNotExist:
                        raise DRFValidationError(f"Report with id {report_id} not found")

                    user = request.user
                    # get_accessible_reports already covers every legitimate
                    # case here: the reporter, the assigned responder, the
                    # department head, or System Admin.
                    has_access = get_accessible_reports(user).filter(id=report.id).exists()

                    if not has_access:
                        raise PermissionDenied("You do not have permission to send messages for this report")

                    message = MessageService.send_message(
                        report=report,
                        user=user,
                        content=content,
                        sync_origin=SyncOrigin.SYNC
                    )

                    results.append({
                        'action': action_type,
                        'status': 'success',
                        'data': {
                            'message_id': str(message.id),
                            'content': message.content,
                            'created_at': message.created_at.isoformat()
                        }
                    })

            except Exception as e:
                results.append({
                    'action': action_type,
                    'status': 'error',
                    'error': str(e)
                })

        return Response({'results': results}, status=200)