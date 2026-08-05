from django.db.models import ProtectedError
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from apps.accounts.models import Permission, Role
from apps.accounts.permissions import CanManageUsers, CanManageRoles
from apps.accounts.serializers_role import PermissionSerializer, RoleSerializer


class PermissionListView(generics.ListAPIView):
    """
    GET /api/v1/permissions/
    Read-only catalogue of every permission that can be attached to a role —
    only whoever builds/edits roles needs to see this (manage_roles, System
    Admin today, but scalable to any future role granted it).
    """
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageRoles]
    pagination_class = None
    queryset = Permission.objects.all()


class RoleListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/roles/ — any user who can manage other users (manage_users)
    needs to see the role list to assign an existing one; this is a narrower
    gate than "any authenticated user" since roles aren't otherwise public.
    POST /api/v1/roles/ — System Admin only (manage_roles) — creating a role
    grants capabilities, a more sensitive action than merely assigning an
    existing one to a user.
    """
    serializer_class = RoleSerializer
    pagination_class = None
    queryset = Role.objects.prefetch_related('permissions').order_by('label')

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), CanManageRoles()]
        return [permissions.IsAuthenticated(), CanManageUsers()]

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs


class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/roles/<id>/ — same read gate as the list view (manage_users).
    PATCH/DELETE /api/v1/roles/<id>/ — System Admin only (manage_roles).
    Built-in roles reject any PATCH via RoleSerializer.validate(); deleting a
    role that's still assigned to a user is blocked at the DB level
    (User.role is on_delete=PROTECT) and surfaced here as a clean 400
    instead of a 500.
    """
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related('permissions')
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated(), CanManageUsers()]
        return [permissions.IsAuthenticated(), CanManageRoles()]

    def perform_destroy(self, instance):
        if instance.is_builtin:
            raise ValidationError('Built-in roles cannot be deleted.')
        try:
            instance.delete()
        except ProtectedError:
            count = instance.users.count()
            raise ValidationError(
                f'Cannot delete this role — it is currently assigned to {count} user(s).'
            )
