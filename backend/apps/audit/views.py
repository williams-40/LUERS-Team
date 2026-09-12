from datetime import datetime
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.views import APIView
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.core.pagination import StandardPagination
from apps.core.export import csv_response, pdf_response
from apps.reports.services import get_accessible_audit_logs
from reportlab.lib.units import inch


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
    Filterable, paginated audit log. Phase 4: no standalone permission
    gate — access is entirely object/query-level via
    get_accessible_audit_logs: System Admin sees everything, a
    department head sees every entry for their department's reports, a
    plain responder sees only their own actions, and a reporter (no
    department affiliation at all) sees nothing. A user with nothing to
    see just gets an empty paginated list, not a 403.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
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
    permission_classes = [permissions.IsAuthenticated]

    HEADER = [
        'Timestamp', 'Action', 'Report ID', 'Report Category', 'Actor',
        'IP Address', 'Device', 'Sync Origin', 'Before State', 'After State',
    ]

    # Proportioned to fit the ~9.6in usable width of a landscape-letter PDF
    # page (see apps.core.export.pdf_response) so columns don't get cropped.
    PDF_COL_WIDTHS = [
        1.0 * inch, 1.1 * inch, 0.7 * inch, 0.9 * inch, 0.8 * inch,
        0.8 * inch, 1.0 * inch, 0.8 * inch, 1.25 * inch, 1.25 * inch,
    ]
    PDF_STATE_MAX_CHARS = 150
    PDF_USER_AGENT_MAX_CHARS = 120

    @classmethod
    def _truncate_state(cls, state):
        text = str(state) if state else ''
        if len(text) > cls.PDF_STATE_MAX_CHARS:
            return text[:cls.PDF_STATE_MAX_CHARS] + '…'
        return text

    @classmethod
    def _truncate_user_agent(cls, user_agent):
        text = user_agent or ''
        if len(text) > cls.PDF_USER_AGENT_MAX_CHARS:
            return text[:cls.PDF_USER_AGENT_MAX_CHARS] + '…'
        return text

    def get(self, request):
        queryset = get_accessible_audit_logs(request.user).select_related('report', 'actor').order_by('-created_at')
        queryset = filter_audit_logs(queryset, request.query_params)

        export_format = request.query_params.get('export_format', 'csv')
        if export_format == 'pdf':
            # Truncated ID/timestamp/state fields to keep columns narrow
            # enough to fit the page without cropping (before/after_state are
            # raw JSON snapshots and can otherwise be unboundedly long; full
            # detail stays available via the CSV export / audit API).
            rows = [
                [
                    entry.created_at.strftime('%Y-%m-%d %H:%M'),
                    entry.get_action_display(),
                    str(entry.report_id)[:8] if entry.report_id else '',
                    entry.report.category if entry.report else '',
                    entry.actor.username if entry.actor else '',
                    entry.ip_address or '',
                    self._truncate_user_agent(entry.user_agent),
                    entry.get_sync_origin_display(),
                    self._truncate_state(entry.before_state),
                    self._truncate_state(entry.after_state),
                ]
                for entry in queryset
            ]
            return pdf_response('Audit Log', self.HEADER, rows, 'audit_log.pdf', col_widths=self.PDF_COL_WIDTHS)

        rows = [
            [
                entry.created_at.isoformat(),
                entry.get_action_display(),
                str(entry.report_id) if entry.report_id else '',
                entry.report.category if entry.report else '',
                entry.actor.username if entry.actor else '',
                entry.ip_address or '',
                entry.user_agent or '',
                entry.get_sync_origin_display(),
                entry.before_state or '',
                entry.after_state or '',
            ]
            for entry in queryset
        ]
        return csv_response(self.HEADER, rows, 'audit_log.csv')
