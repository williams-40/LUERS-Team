from rest_framework import serializers
from apps.reports.models import AssistanceRequest, AssistanceAcknowledgement, Department


class AssistanceAcknowledgementSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    acknowledged_by_username = serializers.CharField(source='acknowledged_by.username', read_only=True, default=None)

    class Meta:
        model = AssistanceAcknowledgement
        fields = ['id', 'department', 'department_name', 'acknowledged_by_username', 'created_at']


class AssistanceRequestSerializer(serializers.ModelSerializer):
    """Read serializer — nested onto ReportDetailSerializer so the frontend gets everything in one fetch."""
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True, default=None)
    departments = serializers.SerializerMethodField()
    acknowledgements = AssistanceAcknowledgementSerializer(many=True, read_only=True)

    class Meta:
        model = AssistanceRequest
        fields = [
            'id', 'report', 'reason', 'requested_by', 'requested_by_username',
            'departments', 'acknowledgements', 'created_at',
        ]

    def get_departments(self, obj):
        return [{'id': str(d.id), 'name': d.name} for d in obj.departments.all()]


class AssistanceRequestCreateSerializer(serializers.Serializer):
    """Reason is required here (unlike Transfer/Escalate's optional one) — the spec explicitly asks the requester to explain why help is needed."""
    departments = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True), many=True
    )
    reason = serializers.CharField(max_length=500)


class AssistanceAcknowledgeSerializer(serializers.Serializer):
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True), source='department'
    )
