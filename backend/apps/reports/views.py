from datetime import datetime
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from apps.reports.models import Report, Evidence, ReportIdentity
from apps.reports.serializers import (
    ReportListSerializer, ReportDetailSerializer, ReportCreateSerializer,
    ReportUpdateStatusSerializer, ReportAssignSerializer, EvidenceSerializer
)
from apps.reports.services import ReportService, IdentityService, MessageService, get_accessible_reports, filter_reports  # ✅ added
from apps.reports.validators import validate_evidence_file
from apps.accounts.permissions import IsSecurity, IsICTAdmin, IsStudentOrStaff, IsManagement, IsAdminTier, IsAccountAdmin
from apps.core.export import csv_response, pdf_response
from apps.core.pagination import StandardPagination
from apps.reports.serializers import SyncRequestSerializer, SyncResultSerializer
from rest_framework.exceptions import ValidationError as DRFValidationError
from apps.core.choices import SyncOrigin


def get_client_ip(request):
    """Utility helper to extract the real IP address from HTTP request metadata."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


@method_decorator(ratelimit(key='user', rate='5/h', method='POST', block=True), name='post')
class ReportCreateView(generics.CreateAPIView):
    """
    POST /api/v1/reports/
    Submit a report (panic or detailed). Supports is_anonymous flag.
    Rate-limited to 5 reports per hour per user.
    """
    serializer_class = ReportCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudentOrStaff]

    def perform_create(self, serializer):
        ip = get_client_ip(self.request)
        report = ReportService.create_report(
            validated_data=serializer.validated_data,
            user=self.request.user,
            ip_address=ip,
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

        return queryset.order_by('updated_at')

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
        'ID', 'Category', 'Status', 'Urgency', 'Anonymous', 'Department',
        'Assigned To', 'Evidence Count', 'Created At', 'Updated At',
    ]

    def get(self, request):
        queryset = get_accessible_reports(request.user)
        queryset = filter_reports(queryset, request.query_params)
        queryset = queryset.select_related('department', 'assigned_to').prefetch_related('evidence').order_by('-created_at')

        rows = [
            [
                str(r.id),
                r.category,
                r.status,
                r.urgency,
                r.is_anonymous,
                r.department.name if r.department else '',
                r.assigned_to.username if r.assigned_to else '',
                len(r.evidence.all()),
                r.created_at.isoformat(),
                r.updated_at.isoformat(),
            ]
            for r in queryset
        ]

        export_format = request.query_params.get('export_format', 'csv')
        if export_format == 'pdf':
            return pdf_response('Reports', self.HEADER, rows, 'reports.pdf')
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
        user = self.request.user
        accessible = get_accessible_reports(user)
        if accessible.filter(id=obj.id).exists():
            return obj
        raise PermissionDenied("You do not have access to this report.")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if user.role not in ['security', 'ict_admin', 'management', 'system_admin'] and instance.is_anonymous:
            raise PermissionDenied("You cannot view anonymous reports.")
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ReportStatusUpdateView(APIView):
    """
    PATCH /api/v1/reports/{id}/status/
    Update report status. Only Security can change status.
    Supports conflict detection via expected_updated_at.
    """
    permission_classes = [permissions.IsAuthenticated, IsSecurity]
    serializer_class = ReportUpdateStatusSerializer

    def patch(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        expected_updated_at = serializer.validated_data.get('expected_updated_at')
        client_timestamp = serializer.validated_data.get('client_timestamp')

        ip = get_client_ip(request)
        result = ReportService.update_status(
            report,
            new_status,
            request.user,
            ip_address=ip,
            expected_updated_at=expected_updated_at,
            client_timestamp=client_timestamp,
            sync_origin=SyncOrigin.LIVE
        )

        if 'error' in result:
            return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': result['status']})


class ReportAssignView(APIView):
    """
    POST /api/v1/reports/{id}/assign/
    Assign a report to a security officer. Allowed for Security and ICT Admin.
    Supports conflict detection via expected_updated_at.
    """
    permission_classes = [permissions.IsAuthenticated, IsSecurity | IsICTAdmin]
    serializer_class = ReportAssignSerializer

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        assigned_to = serializer.validated_data['assigned_to']
        expected_updated_at = serializer.validated_data.get('expected_updated_at')
        client_timestamp = serializer.validated_data.get('client_timestamp')

        ip = get_client_ip(request)
        result = ReportService.assign_report(
            report,
            assigned_to,
            request.user,
            ip_address=ip,
            expected_updated_at=expected_updated_at,
            client_timestamp=client_timestamp,
            sync_origin=SyncOrigin.LIVE
        )
        return Response({'assigned_to': result['assigned_to']})


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
        is_security = user.role == 'security'
        is_owner = False
        if not report.is_anonymous:
            identity = ReportIdentity.objects.filter(report=report).first()
            is_owner = IdentityService.is_owner(identity, user)

        if not (is_security or is_owner):
            raise PermissionDenied("You do not have permission to upload evidence for this report.")

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_type = validate_evidence_file(file)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        ip = get_client_ip(request)
        evidence = ReportService.add_evidence(
            report,
            file,
            file_type,
            user,
            ip_address=ip,
            sync_origin=SyncOrigin.LIVE
        )
        serializer = self.serializer_class(evidence, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReportRevealIdentityView(APIView):
    """
    POST /api/v1/reports/{id}/reveal/
    Decrypt and return the reporter's identity. Restricted to Management
    (the Escrow Authority) since deanonymization is that role's purpose.
    Logs a 'deanonymize' audit entry regardless of whether an identity
    is found, capturing who attempted the reveal.
    """
    permission_classes = [permissions.IsAuthenticated, IsManagement]

    def post(self, request, id):
        report = get_object_or_404(Report, id=id)
        ip = get_client_ip(request)

        reporter = IdentityService.reveal_identity(
            report,
            request.user,
            ip_address=ip,
            sync_origin=SyncOrigin.LIVE,
        )

        if reporter is None:
            return Response(
                {'error': 'No identity record exists for this report.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'reporter_id': str(reporter.id),
            'username': reporter.username,
            'email': reporter.email,
            'university_id': reporter.university_id,
        })


class ReportDeleteView(APIView):
    """
    POST /api/v1/reports/{id}/delete/
    Soft-deletes a report (sets deleted_at) — excludes it from the triage
    queue, dashboards, search, and every reporter's own view, but keeps the
    row (and its Evidence/ReportIdentity) intact until purge_deleted_reports
    hard-deletes it after the retention window. Account-admin only (not
    Management — that's the escrow-reveal governance role, a separate
    concern from day-to-day account/report administration).
    """
    permission_classes = [permissions.IsAuthenticated, IsAccountAdmin]

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        ip = get_client_ip(request)
        ReportService.soft_delete(report, request.user, ip_address=ip, sync_origin=SyncOrigin.LIVE)
        return Response({'id': str(report.id), 'deleted_at': report.deleted_at})


class ReportRestoreView(APIView):
    """
    POST /api/v1/reports/{id}/restore/
    Clears deleted_at on a soft-deleted report. Account-admin only.
    """
    permission_classes = [permissions.IsAuthenticated, IsAccountAdmin]

    def post(self, request, id):
        report = get_object_or_404(
            get_accessible_reports(request.user, include_deleted=True).filter(deleted_at__isnull=False),
            id=id,
        )
        ip = get_client_ip(request)
        ReportService.restore(report, request.user, ip_address=ip, sync_origin=SyncOrigin.LIVE)
        return Response({'id': str(report.id), 'deleted_at': None})


class ReportDeletedListView(generics.ListAPIView):
    """
    GET /api/v1/reports/deleted/
    Lists soft-deleted reports (deleted_at set) so an admin can review and
    restore them. Without this endpoint, soft-delete would be write-only.
    Account-admin only.
    """
    serializer_class = ReportListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAccountAdmin]
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
        return get_accessible_reports(self.request.user)


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
                        sync_origin=SyncOrigin.SYNC
                    )
                    detail_serializer = ReportDetailSerializer(report, context={'request': request})
                    results.append({
                        'action': action_type,
                        'status': 'success',
                        'data': detail_serializer.data
                    })

                elif action_type == 'update_status':
                    if not IsSecurity().has_permission(request, None):
                        raise PermissionDenied("Only security officers can update report status")

                    try:
                        report = Report.objects.get(id=report_id)
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
                    has_access = False
                    # Admin roles
                    if user.role in ['security', 'ict_admin', 'management', 'system_admin']:
                        has_access = True
                    else:
                        # Reporter check (non-anonymous only)
                        if not report.is_anonymous:
                            try:
                                identity = ReportIdentity.objects.get(report=report)
                                reporter_id = IdentityService.get_reporter(identity)
                                if reporter_id and str(user.id) == reporter_id:
                                    has_access = True
                            except ReportIdentity.DoesNotExist:
                                pass
                        # Assigned officer check
                        if report.assigned_to and report.assigned_to.id == user.id:
                            has_access = True

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