from rest_framework import serializers
from apps.reports.models import ReportFeedback


class ReportFeedbackSubmitSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comments = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class ReportFeedbackSerializer(serializers.ModelSerializer):
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True, default=None)
    report_id = serializers.UUIDField(source='report.id', read_only=True)
    department_name = serializers.CharField(source='report.department.name', read_only=True, default=None)

    class Meta:
        model = ReportFeedback
        fields = ['id', 'report_id', 'department_name', 'rating', 'comments', 'submitted_by_username', 'created_at']
