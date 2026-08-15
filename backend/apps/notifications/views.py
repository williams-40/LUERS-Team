from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from apps.reports.models import Report
from apps.notifications.models import Message
from apps.notifications.serializers import MessageSerializer, MessageCreateSerializer
from apps.reports.services import can_access_report


class CanAccessReportMixin:
    """
    Mixin to check if the current user can access the report.

    Delegates entirely to apps.reports.services.can_access_report (which
    wraps get_accessible_reports) — the same function REST detail/list and
    the WebSocket consumer already use. Previously this mixin had its own,
    independently-written check that had drifted from that one: it treated
    view_admin_dashboard as blanket access (get_accessible_reports uses
    view_all_reports for that) and never considered department headship at
    all. include_deleted=True matches this mixin's pre-existing behavior —
    it never filtered on deleted_at either, since it looked reports up by
    raw id — so this consolidation doesn't newly restrict access to a
    soft-deleted report's messages.
    """
    def get_report_and_check_access(self, report_id):
        report = get_object_or_404(Report, id=report_id)
        user = self.request.user

        if can_access_report(user, report, include_deleted=True):
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