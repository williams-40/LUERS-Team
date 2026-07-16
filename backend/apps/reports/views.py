import os
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from apps.reports.models import Report, Evidence
from apps.reports.serializers import (
    ReportListSerializer, ReportDetailSerializer, ReportCreateSerializer,
    ReportUpdateStatusSerializer, ReportAssignSerializer, EvidenceSerializer
)
from apps.reports.services import ReportService
from apps.accounts.permissions import IsSecurity, IsICTAdmin, IsStudentOrStaff
from apps.core.pagination import StandardPagination


def get_client_ip(request):
    """Utility helper to extract the real IP address from HTTP request metadata."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


# Allowed file extensions for evidence uploads
ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.pdf']
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


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
            ip_address=ip
        )
        serializer.instance = report


class ReportListView(generics.ListAPIView):
    """
    GET /api/v1/reports/
    List reports with filtering by status, category, urgency.
    Only Security and ICT Admin can access.
    """
    serializer_class = ReportListSerializer
    permission_classes = [permissions.IsAuthenticated, IsSecurity | IsICTAdmin]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Report.objects.all().select_related('assigned_to').prefetch_related('evidence')
        status = self.request.query_params.get('status')
        category = self.request.query_params.get('category')
        urgency = self.request.query_params.get('urgency')
        if status:
            queryset = queryset.filter(status=status)
        if category:
            queryset = queryset.filter(category=category)
        if urgency:
            queryset = queryset.filter(urgency=urgency)
        return queryset.order_by('-created_at') 


class ReportDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/reports/{id}/
    """
    serializer_class = ReportDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        if user.role in ['security', 'ict_admin']:
            return Report.objects.all().prefetch_related('evidence', 'audit_logs')

        from apps.reports.models import ReportIdentity
        pattern = f"PLACEHOLDER_{user.id}"
        identities = ReportIdentity.objects.filter(encrypted_reporter_ref__icontains=pattern)
        report_ids = identities.values_list('report_id', flat=True)
        return Report.objects.filter(id__in=report_ids, is_anonymous=False)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if user.role not in ['security', 'ict_admin'] and instance.is_anonymous:
            raise PermissionDenied("You cannot view anonymous reports.")
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ReportStatusUpdateView(APIView):
    """
    PATCH /api/v1/reports/{id}/status/
    Update report status. Only Security can change status.
    """
    permission_classes = [permissions.IsAuthenticated, IsSecurity]
    serializer_class = ReportUpdateStatusSerializer  # ✅ Added to satisfy drf-spectacular

    def patch(self, request, id):
        report = get_object_or_404(Report, id=id)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']

        ip = get_client_ip(request)
        result = ReportService.update_status(report, new_status, request.user, ip_address=ip)

        if 'error' in result:
            return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': result['status']})


class ReportAssignView(APIView):
    """
    POST /api/v1/reports/{id}/assign/
    Assign a report to a security officer. Allowed for Security and ICT Admin.
    """
    permission_classes = [permissions.IsAuthenticated, IsSecurity | IsICTAdmin]
    serializer_class = ReportAssignSerializer  # ✅ Added to satisfy drf-spectacular

    def post(self, request, id):
        report = get_object_or_404(Report, id=id)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        assigned_to = serializer.validated_data['assigned_to']

        ip = get_client_ip(request)
        result = ReportService.assign_report(report, assigned_to, request.user, ip_address=ip)
        return Response({'assigned_to': result['assigned_to']})


class EvidenceUploadView(APIView):
    """
    POST /api/v1/reports/{id}/evidence/
    Upload evidence file. Validates file size and extension.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EvidenceSerializer  # ✅ Added to satisfy drf-spectacular

    def post(self, request, id):
        report = get_object_or_404(Report, id=id)
        user = request.user
        is_security = user.role == 'security'
        is_owner = False
        if not report.is_anonymous:
            from apps.reports.models import ReportIdentity
            pattern = f"PLACEHOLDER_{user.id}"
            identity = ReportIdentity.objects.filter(report=report, encrypted_reporter_ref__icontains=pattern).first()
            if identity:
                is_owner = True

        if not (is_security or is_owner):
            raise PermissionDenied("You do not have permission to upload evidence for this report.")

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # File size validation
        if file.size > MAX_FILE_SIZE:
            return Response(
                {'error': f'File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # File extension validation
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        content_type = getattr(file, 'content_type', '')
        if content_type.startswith('image/'):
            file_type = 'image'
        elif content_type.startswith('video/'):
            file_type = 'video'
        elif content_type.startswith('audio/'):
            file_type = 'audio'
        else:
            file_type = 'other'

        ip = get_client_ip(request)
        evidence = ReportService.add_evidence(report, file, file_type, user, ip_address=ip)
        serializer = self.serializer_class(evidence, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyReportsView(generics.ListAPIView):
    """
    GET /api/v1/reports/mine/
    """
    serializer_class = ReportListSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudentOrStaff]

    def get_queryset(self):
        user = self.request.user
        from apps.reports.models import ReportIdentity
        pattern = f"PLACEHOLDER_{user.id}"
        identities = ReportIdentity.objects.filter(encrypted_reporter_ref__icontains=pattern)
        report_ids = identities.values_list('report_id', flat=True)
        return Report.objects.filter(id__in=report_ids, is_anonymous=False)