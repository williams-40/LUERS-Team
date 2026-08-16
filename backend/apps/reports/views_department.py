from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from apps.reports.models import Department
from apps.reports.serializers_department import DepartmentSerializer, DepartmentWriteSerializer
from apps.accounts.permissions import CanManageDepartments
from apps.accounts.serializers import ResponderCreateSerializer, UserSerializer
from apps.accounts.services import PasswordResetService
from apps.audit.models import AuditLog
from apps.core.choices import Action
from apps.core.pagination import StandardPagination


class DepartmentListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/departments/ — any authenticated user (reporters need the
    active department list to submit a report against; a department head
    needs to see their own department here too).
    POST /api/v1/departments/ — ICT Admin / System Admin only.
    """
    pagination_class = StandardPagination
    queryset = Department.objects.select_related('head').prefetch_related('members').order_by('name')

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), CanManageDepartments()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        return DepartmentSerializer if self.request.method == 'GET' else DepartmentWriteSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/departments/<id>/ — any authenticated user (a department
    head needs their own department's member list to build an assignment
    dropdown).
    PATCH/DELETE /api/v1/departments/<id>/ — ICT Admin / System Admin only.
    Report.department is SET_NULL, so deleting a department is DB-safe —
    it orphans historical reports' department attribution rather than
    erroring or cascading.
    """
    queryset = Department.objects.select_related('head').prefetch_related('members')
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), CanManageDepartments()]

    def get_serializer_class(self):
        return DepartmentSerializer if self.request.method == 'GET' else DepartmentWriteSerializer


@method_decorator(ratelimit(key='user', rate='10/h', method='POST', block=True), name='post')
class DepartmentResponderCreateView(GenericAPIView):
    """
    POST /api/v1/departments/<id>/responders/
    Phase 6: lets a department's own head create a responder account
    scoped to that department, with no role/department/password ever
    supplied by the client (see ResponderCreateSerializer). Deliberately
    department-head-only, not extended to system_admin — system_admin
    already has a fully general provisioning path via
    AdminUserListCreateView + this same DepartmentDetailView's member
    PATCH, so keeping this endpoint's authorization to a single
    object-level headship check keeps it minimal and auditable. No
    dedicated permission slug is used — matches this codebase's existing
    `is_department_head_or_system_admin`-style precedent of gating
    department-head actions on the relationship itself, not a role or
    permission flag.

    Phase 8: rate-limited per-user (matching ReportCreateView's own
    authenticated-endpoint precedent, rather than the per-IP key used by
    the AllowAny auth endpoints) — this is a real account-creation
    surface reachable by any department head, flagged as a gap in the
    Phase 6 design doc (D.9) but not closed until now.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ResponderCreateSerializer

    def post(self, request, id):
        department = get_object_or_404(Department, id=id, is_active=True)
        if department.head_id != request.user.id:
            raise PermissionDenied("Only this department's head may create a responder account here.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        department.members.add(user)

        PasswordResetService.request_reset(user.email)

        AuditLog.objects.create(
            actor=request.user,
            action=Action.RESPONDER_CREATED,
            after_state={
                'user_id': str(user.id),
                'username': user.username,
                'department_id': str(department.id),
                'department_name': department.name,
            },
        )

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
