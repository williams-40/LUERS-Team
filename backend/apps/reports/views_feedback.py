from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from django.shortcuts import get_object_or_404

from apps.reports.models import ReportFeedback
from apps.reports.serializers import ReportListSerializer
from apps.reports.serializers_feedback import ReportFeedbackSubmitSerializer, ReportFeedbackSerializer
from apps.reports.services import ReportService, get_accessible_reports, get_pending_feedback_reports
from apps.audit.models import AuditLog
from apps.core.choices import Action, SyncOrigin
from apps.accounts.permissions import CanViewAllReports
from apps.core.request_utils import get_client_ip, get_user_agent


class ReportFeedbackView(APIView):
    """
    GET/POST /api/v1/reports/{id}/feedback/
    GET: viewable by anyone with report access (department head/member/
    assigned responder/System Admin, or the reporter's own non-anonymous
    report — all already covered by get_accessible_reports). Logs a
    VIEW_FEEDBACK audit entry per view for accountability.
    POST: only the report's own reporter, only once, only once Resolved
    (see ReportService.submit_feedback for the actual guards) — auto-closes
    the report on success.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        feedback = getattr(report, 'feedback', None)
        if feedback is None:
            raise NotFound('No feedback has been submitted for this report yet.')

        AuditLog.objects.create(
            report=report,
            actor=request.user,
            action=Action.VIEW_FEEDBACK,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            sync_origin=SyncOrigin.LIVE,
        )
        return Response(ReportFeedbackSerializer(feedback).data)

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        serializer = ReportFeedbackSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip = get_client_ip(request)
        ua = get_user_agent(request)
        feedback = ReportService.submit_feedback(
            report,
            request.user,
            rating=serializer.validated_data['rating'],
            comments=serializer.validated_data.get('comments', ''),
            ip_address=ip,
            user_agent=ua,
            sync_origin=SyncOrigin.LIVE,
        )
        return Response(ReportFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED)


class PendingFeedbackListView(APIView):
    """
    GET /api/v1/reports/pending-feedback/
    The caller's own Resolved reports with no feedback yet — feeds the
    global auto-prompt (FeedbackPrompt) rather than a paginated page.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = get_pending_feedback_reports(request.user).order_by('-created_at')
        return Response({'results': ReportListSerializer(queryset, many=True).data})


class AdminFeedbackListView(generics.ListAPIView):
    """
    GET /api/v1/reports/feedback/
    All submitted feedback, campus-wide — System Admin only (view_all_reports).
    """
    serializer_class = ReportFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated, CanViewAllReports]

    def get_queryset(self):
        return ReportFeedback.objects.select_related('report', 'report__department', 'submitted_by').order_by('-created_at')
