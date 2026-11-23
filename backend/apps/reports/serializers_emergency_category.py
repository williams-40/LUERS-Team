"""
EmergencyCategory CRUD serializers — mirrors serializers_department.py's
own read/write split exactly, since this is the same kind of admin-managed
routing-configuration entity.
"""
import re
from rest_framework import serializers
from apps.reports.models import EmergencyCategory

SLUG_PATTERN = re.compile(r'^[a-z0-9_-]+$')


class EmergencyCategorySerializer(serializers.ModelSerializer):
    """Read shape — list/retrieve, including the picker."""
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = EmergencyCategory
        fields = [
            'id', 'name', 'slug', 'description', 'department', 'department_name',
            'requires_description_and_routing', 'is_active', 'sort_order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmergencyCategoryWriteSerializer(serializers.ModelSerializer):
    """Create/update shape."""

    class Meta:
        model = EmergencyCategory
        fields = [
            'name', 'slug', 'description', 'department',
            'requires_description_and_routing', 'is_active', 'sort_order',
        ]

    def validate_slug(self, value):
        if not SLUG_PATTERN.match(value):
            raise serializers.ValidationError(
                "Slug can only contain lowercase letters, numbers, hyphens, and underscores."
            )
        return value
