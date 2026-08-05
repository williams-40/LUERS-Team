"""
Department CRUD serializers.

As of Phase 14, Department Head/Responder (member) is its own axis,
decoupled from the account Role enum — any active user can be a head or
member (departments like Finance/HR/Library have no corresponding Role
at all). `validate_head`/`validate_members` used to reject non-admin-tier
users; that restriction is gone.
"""
from rest_framework import serializers
from apps.reports.models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """Read shape — list/retrieve."""
    head_username = serializers.CharField(source='head.username', read_only=True, default=None)
    member_usernames = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'description', 'head', 'head_username',
            'members', 'member_usernames', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_member_usernames(self, obj):
        return list(obj.members.values_list('username', flat=True))


class DepartmentWriteSerializer(serializers.ModelSerializer):
    """Create/update shape."""

    class Meta:
        model = Department
        fields = ['name', 'description', 'head', 'members', 'is_active']

    def validate_head(self, value):
        if value is not None and not value.is_active:
            raise serializers.ValidationError(f"{value.username} is not an active account.")
        return value

    def validate_members(self, value):
        inactive = [u.username for u in value if not u.is_active]
        if inactive:
            raise serializers.ValidationError(
                f"These users are not active accounts and cannot be department members: {', '.join(inactive)}"
            )
        return value
