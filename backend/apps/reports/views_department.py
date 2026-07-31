from rest_framework import generics, permissions
from apps.reports.models import Department
from apps.reports.serializers_department import DepartmentSerializer, DepartmentWriteSerializer
from apps.accounts.permissions import IsAccountAdmin
from apps.core.pagination import StandardPagination


class DepartmentListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/departments/
    POST /api/v1/departments/
    ICT Admin / System Admin only.
    """
    permission_classes = [permissions.IsAuthenticated, IsAccountAdmin]
    pagination_class = StandardPagination
    queryset = Department.objects.select_related('head').prefetch_related('members').order_by('name')

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
    GET/PATCH/DELETE /api/v1/departments/<id>/
    ICT Admin / System Admin only. Report.department is SET_NULL, so
    deleting a department is DB-safe — it orphans historical reports'
    department attribution rather than erroring or cascading.
    """
    permission_classes = [permissions.IsAuthenticated, IsAccountAdmin]
    queryset = Department.objects.select_related('head').prefetch_related('members')
    lookup_field = 'id'

    def get_serializer_class(self):
        return DepartmentSerializer if self.request.method == 'GET' else DepartmentWriteSerializer
