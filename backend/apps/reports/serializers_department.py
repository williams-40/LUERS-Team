"""
Department CRUD serializers.

NOTE on `name`: apps/reports/mapping.py's CATEGORY_DEPARTMENT_MAP hardcodes
5 department names (Security, Academic Affairs, Health & Safety,
Administration, Other) that get_department_for_category looks up by exact
match. Renaming one of those 5 via this API will silently break
category-based auto-routing for that category — get_department_for_category
will just return None from then on, no error, no log. Not guarded at
runtime here (deliberately out of scope); flagging for whoever edits
departments later.
"""
from rest_framework import serializers
from apps.reports.models import Department

# Mirrors the role list used by get_accessible_reports (apps/reports/services.py)
# and IsAdminTier (apps/accounts/permissions.py) — head/members must be
# admin-tier because both grant department-wide report visibility there.
ADMIN_TIER_ROLES = ['security', 'ict_admin', 'management', 'system_admin']


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
        if value is not None and value.role not in ADMIN_TIER_ROLES:
            raise serializers.ValidationError(
                f"{value.username} has role '{value.role}' — department head must be admin-tier "
                f"({', '.join(ADMIN_TIER_ROLES)}), since Department.head grants full visibility "
                f"into that department's reports."
            )
        return value

    def validate_members(self, value):
        bad = [u.username for u in value if u.role not in ADMIN_TIER_ROLES]
        if bad:
            raise serializers.ValidationError(
                f"These users are not admin-tier and cannot be department members: {', '.join(bad)}"
            )
        return value
