from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.reports.serializers import BulkStatusUpdateSerializer, BulkAssignSerializer
from apps.reports.services import ReportService, get_accessible_reports
from apps.accounts.permissions import IsSecurity, IsICTAdmin
from apps.core.choices import SyncOrigin


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


class BulkStatusUpdateView(APIView):
    """
    POST /api/v1/reports/bulk/status/
    Bulk status update from the triage queue's multi-select toolbar.
    Security only, mirroring ReportStatusUpdateView. Deliberately omits
    expected_updated_at — there's no clean bulk UX for capturing "the
    updated_at I last saw" per selected row, so this applies against
    current server state ("do this to whatever's selected right now")
    rather than the single-report optimistic-concurrency semantics.
    Always returns 200 with a per-item results list; a bad request_ids/
    status shape still raises a normal 400 via serializer validation.
    """
    permission_classes = [permissions.IsAuthenticated, IsSecurity]

    def post(self, request):
        serializer = BulkStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report_ids = serializer.validated_data['report_ids']
        new_status = serializer.validated_data['status']
        accessible = get_accessible_reports(request.user)
        ip = get_client_ip(request)

        results = []
        for report_id in report_ids:
            report = accessible.filter(id=report_id).first()
            if report is None:
                results.append({
                    'report_id': str(report_id), 'status': 'error',
                    'error': 'Report not found or not accessible.',
                })
                continue
            try:
                result = ReportService.update_status(
                    report, new_status, request.user, ip_address=ip, sync_origin=SyncOrigin.LIVE,
                )
                if 'error' in result:
                    results.append({'report_id': str(report_id), 'status': 'error', 'error': result['error']})
                else:
                    results.append({'report_id': str(report_id), 'status': 'success'})
            except Exception as e:
                results.append({'report_id': str(report_id), 'status': 'error', 'error': str(e)})

        return Response({'results': results}, status=status.HTTP_200_OK)


class BulkAssignView(APIView):
    """
    POST /api/v1/reports/bulk/assign/
    Bulk assignment from the triage queue's multi-select toolbar.
    Security or ICT Admin, mirroring ReportAssignView. Same
    no-expected_updated_at rationale as BulkStatusUpdateView.
    """
    permission_classes = [permissions.IsAuthenticated, IsSecurity | IsICTAdmin]

    def post(self, request):
        serializer = BulkAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report_ids = serializer.validated_data['report_ids']
        assigned_to = serializer.validated_data['assigned_to']
        accessible = get_accessible_reports(request.user)
        ip = get_client_ip(request)

        results = []
        for report_id in report_ids:
            report = accessible.filter(id=report_id).first()
            if report is None:
                results.append({
                    'report_id': str(report_id), 'status': 'error',
                    'error': 'Report not found or not accessible.',
                })
                continue
            try:
                ReportService.assign_report(
                    report, assigned_to, request.user, ip_address=ip, sync_origin=SyncOrigin.LIVE,
                )
                results.append({'report_id': str(report_id), 'status': 'success'})
            except Exception as e:
                results.append({'report_id': str(report_id), 'status': 'error', 'error': str(e)})

        return Response({'results': results}, status=status.HTTP_200_OK)
