from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from apps.reports.models import Report
from apps.notifications.models import Message
from apps.notifications.serializers import MessageSerializer, MessageCreateSerializer
from apps.accounts.permissions import IsSecurity, IsICTAdmin, IsManagement
from apps.reports.services import IdentityService


class CanAccessReportMixin:
    """Mixin to check if the current user can access the report."""
    def get_report_and_check_access(self, report_id):
        report = get_object_or_404(Report, id=report_id)
        user = self.request.user

        # Admin roles have full access (case‑insensitive)
        admin_roles = {'security', 'ict_admin', 'management'}
        if user.role and user.role.lower() in admin_roles:
            return report

        # Check if user is the reporter (non‑anonymous only)
        if not report.is_anonymous:
            from apps.reports.models import ReportIdentity
            try:
                identity = ReportIdentity.objects.get(report=report)
                reporter_id = IdentityService.get_reporter(identity)
                if reporter_id and str(user.id) == reporter_id:
                    return report
            except ReportIdentity.DoesNotExist:
                pass

        # Check if user is the assigned officer
        if report.assigned_to and report.assigned_to.id == user.id:
            return report

        self.permission_denied(self.request, message="You do not have access to this report.")


class MessageListView(generics.ListAPIView, CanAccessReportMixin):
    """
    GET /api/v1/reports/{report_id}/messages/
    Fetch messages for a report (paginated, ordered by created_at).
    """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        report = self.get_report_and_check_access(self.kwargs['report_id'])
        return Message.objects.filter(report=report).order_by('created_at')


class MessageCreateView(generics.CreateAPIView, CanAccessReportMixin):
    """
    POST /api/v1/reports/{report_id}/messages/create/
    Send a message for a report via REST.
    """
    serializer_class = MessageCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        report = self.get_report_and_check_access(self.kwargs['report_id'])
        context['report'] = report
        return context

    def perform_create(self, serializer):
        # The serializer's create() will use the report from context
        serializer.save()