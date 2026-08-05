from datetime import datetime
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.views import APIView
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.accounts.permissions import HasAuditAccess
from apps.core.pagination import StandardPagination
from apps.core.export import csv_response, pdf_response
from apps.reports.services import get_accessible_audit_logs


def filter_audit_logs(queryset, params):
    report = params.get('report')
    actor = params.get('actor')
    action = params.get('action')
    date_from = params.get('date_from')
    date_to = params.get('date_to')

    if report:
        queryset = queryset.filter(report_id=report)
    if actor:
        queryset = queryset.filter(actor_id=actor)
    if action:
        queryset = queryset.filter(action=action)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            queryset = queryset.filter(created_at__gte=dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            queryset = queryset.filter(created_at__lte=dt)
        except ValueError:
            pass

    return queryset


class AuditLogListView(generics.ListAPIView):
    """
    GET /api/v1/audit/
    Filterable, paginated audit log, scoped via get_accessible_audit_logs:
    System Admin sees everything; a department head sees every entry for
    their department's reports; a responder (member) sees only their own
    actions.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasAuditAccess]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = get_accessible_audit_logs(self.request.user).select_related('report', 'actor').order_by('-created_at')
        return filter_audit_logs(queryset, self.request.query_params)


class AuditLogExportView(APIView):
    """
    GET /api/v1/audit/export/?export_format=csv|pdf&...same filters as the list view...
    Same scoping as AuditLogListView.

    Uses 'export_format' rather than DRF's reserved 'format' query param —
    see ReportExportView's docstring for why.
    """
    permission_classes = [permissions.IsAuthenticated, HasAuditAccess]

    HEADER = [
        'Timestamp', 'Action', 'Report ID', 'Report Category', 'Actor',
        'IP Address', 'Sync Origin', 'Before State', 'After State',
    ]

    def get(self, request):
        queryset = get_accessible_audit_logs(request.user).select_related('report', 'actor').order_by('-created_at')
        queryset = filter_audit_logs(queryset, request.query_params)

        rows = [
            [
                entry.created_at.isoformat(),
                entry.get_action_display(),
                str(entry.report_id) if entry.report_id else '',
                entry.report.category if entry.report else '',
                entry.actor.username if entry.actor else '',
                entry.ip_address or '',
                entry.get_sync_origin_display(),
                entry.before_state or '',
                entry.after_state or '',
            ]
            for entry in queryset
        ]

        export_format = request.query_params.get('export_format', 'csv')
        if export_format == 'pdf':
            return pdf_response('Audit Log', self.HEADER, rows, 'audit_log.pdf')
        return csv_response(self.HEADER, rows, 'audit_log.csv')
