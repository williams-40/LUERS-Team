from rest_framework import serializers
from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    report_category = serializers.CharField(source='report.category', read_only=True, default=None)
    actor_username = serializers.CharField(source='actor.username', read_only=True, default=None)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    sync_origin_display = serializers.CharField(source='get_sync_origin_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'report', 'report_category', 'actor', 'actor_username',
            'action', 'action_display', 'before_state', 'after_state',
            'ip_address', 'user_agent', 'client_timestamp', 'sync_origin', 'sync_origin_display',
            'created_at',
        ]
