from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from apps.reports.models import AssistanceRequest
from apps.reports.serializers_assistance import (
    AssistanceRequestSerializer, AssistanceRequestCreateSerializer, AssistanceAcknowledgeSerializer,
)
from apps.reports.services import (
    ReportService, get_accessible_reports, can_request_assistance, is_department_member_or_head,
)
from apps.core.choices import SyncOrigin


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


class AssistanceRequestCreateView(APIView):
    """
    POST /api/v1/reports/{id}/request-assistance/
    Lets the report's assigned responder, its department head, or System
    Admin ask one or more other departments for help. The requesting
    department keeps ownership; the selected departments just gain
    visibility into the report (see get_accessible_reports).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistanceRequestCreateSerializer

    def post(self, request, id):
        report = get_object_or_404(get_accessible_reports(request.user), id=id)
        if not can_request_assistance(request.user, report):
            raise PermissionDenied(
                "Only this report's assigned responder, its department head, or a System Admin can request assistance."
            )

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        departments = serializer.validated_data['departments']
        reason = serializer.validated_data['reason']

        ip = get_client_ip(request)
        assistance_request = ReportService.request_assistance(
            report, departments, reason, request.user, ip_address=ip, sync_origin=SyncOrigin.LIVE
        )
        return Response(
            AssistanceRequestSerializer(assistance_request).data, status=status.HTTP_201_CREATED
        )


class AssistanceRequestAcknowledgeView(APIView):
    """
    POST /api/v1/assistance-requests/{id}/acknowledge/
    Body: {"department_id": "..."}. Only a head/member of the named
    department — which must itself be one of this request's target
    departments — may acknowledge on that department's behalf.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistanceAcknowledgeSerializer

    def post(self, request, id):
        assistance_request = get_object_or_404(
            AssistanceRequest.objects.filter(report__in=get_accessible_reports(request.user)),
            id=id,
        )

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = serializer.validated_data['department']

        if not assistance_request.departments.filter(id=department.id).exists():
            raise PermissionDenied("This department was not asked for assistance on this report.")
        if not is_department_member_or_head(request.user, department):
            raise PermissionDenied("Only a head or member of the named department can acknowledge on its behalf.")

        ip = get_client_ip(request)
        ReportService.acknowledge_assistance(
            assistance_request, department, request.user, ip_address=ip, sync_origin=SyncOrigin.LIVE
        )
        return Response(AssistanceRequestSerializer(assistance_request).data)
