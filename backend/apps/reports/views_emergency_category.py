from rest_framework import generics, permissions
from apps.reports.models import EmergencyCategory
from apps.reports.serializers_emergency_category import EmergencyCategorySerializer, EmergencyCategoryWriteSerializer
from apps.accounts.permissions import CanManageEmergencyCategories
from apps.core.pagination import StandardPagination


class EmergencyCategoryListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/emergency-categories/ — any authenticated user (the report
    form's category picker needs the active list).
    POST /api/v1/emergency-categories/ — System Admin only.
    """
    pagination_class = StandardPagination
    queryset = EmergencyCategory.objects.select_related('department').order_by('sort_order', 'name')

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), CanManageEmergencyCategories()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        return EmergencyCategorySerializer if self.request.method == 'GET' else EmergencyCategoryWriteSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs


class EmergencyCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/emergency-categories/<id>/ — any authenticated user.
    PATCH/DELETE /api/v1/emergency-categories/<id>/ — System Admin only.
    EmergencyDispatch.emergency_type is a plain string (the slug at
    creation time), not an FK, so deleting a category never cascades or
    errors against existing reports — their emergency_type_label snapshot
    keeps displaying correctly regardless.
    """
    queryset = EmergencyCategory.objects.select_related('department')
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), CanManageEmergencyCategories()]

    def get_serializer_class(self):
        return EmergencyCategorySerializer if self.request.method == 'GET' else EmergencyCategoryWriteSerializer
