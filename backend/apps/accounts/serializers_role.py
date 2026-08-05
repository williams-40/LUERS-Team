"""
Role / Permission CRUD serializers. Only System Admin (the `manage_roles`
permission) may create, edit, or delete roles — see views_role.py. Built-in
roles (`is_builtin=True`) are fully locked here: no field may be changed,
protecting what the original 6 role names mean.
"""
from rest_framework import serializers
from apps.accounts.models import Permission, Role


class PermissionSerializer(serializers.ModelSerializer):
    """Read-only — the permission catalogue is seeded by migration, not
    created through the API."""
    class Meta:
        model = Permission
        fields = ['id', 'slug', 'label', 'description', 'category']
        read_only_fields = fields


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(
        slug_field='slug', many=True, queryset=Permission.objects.all(), required=False,
    )

    class Meta:
        model = Role
        fields = ['id', 'slug', 'label', 'description', 'permissions', 'is_builtin', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_builtin', 'created_at', 'updated_at']

    def validate(self, attrs):
        if self.instance is not None and self.instance.is_builtin:
            raise serializers.ValidationError('Built-in roles cannot be edited.')
        return attrs
