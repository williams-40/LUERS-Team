from rest_framework import generics, permissions
from apps.reports.models import Department
from apps.reports.serializers_department import DepartmentSerializer, DepartmentWriteSerializer
from apps.accounts.permissions import CanManageDepartments
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
