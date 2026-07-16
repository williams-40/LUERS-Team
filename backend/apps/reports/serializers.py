from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.reports.models import Report, Evidence, ReportIdentity
from apps.core.choices import Category, Urgency, Status

User = get_user_model()

class EvidenceSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = ['id', 'file', 'file_url', 'file_type', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

class ReportListSerializer(serializers.ModelSerializer):
    """Used for list views (officer dashboard) - hides reporter identity."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    urgency_display = serializers.CharField(source='get_urgency_display', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    evidence_count = serializers.IntegerField(source='evidence.count', read_only=True)

    class Meta:
        model = Report
        fields = [
            'id', 'category', 'category_display', 'description', 'urgency', 'urgency_display',
            'status', 'status_display', 'latitude', 'longitude', 'location_accuracy',
            'assigned_to', 'assigned_to_username', 'is_anonymous', 'created_at', 'updated_at',
            'evidence_count'
        ]

class ReportDetailSerializer(serializers.ModelSerializer):
    """Used for detail view - includes evidence and audit trail (optional)."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    urgency_display = serializers.CharField(source='get_urgency_display', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    evidence = EvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = Report
        fields = [
            'id', 'category', 'category_display', 'description', 'urgency', 'urgency_display',
            'status', 'status_display', 'latitude', 'longitude', 'location_accuracy',
            'assigned_to', 'assigned_to_username', 'is_anonymous', 'metadata', 'created_at', 'updated_at',
            'evidence'
        ]

class ReportCreateSerializer(serializers.ModelSerializer):
    """Used for report submission - handles anonymous toggle and creates ReportIdentity."""
    evidence = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Report
        fields = [
            'id',
            'category',
            'description',
            'urgency',
            'is_anonymous',
            'latitude',
            'longitude',
            'location_accuracy',
            'assigned_to',
            'status',
            'created_at',
            'evidence'
        ]
        read_only_fields = ['id', 'status', 'created_at']
        extra_kwargs = {
            'category': {'required': True},
            'description': {'required': True},
        }

    def create(self, validated_data):
        evidence_files = validated_data.pop('evidence', [])
        validated_data.setdefault('urgency', 'normal')

        request = self.context.get('request')
        user = request.user if request else None

        report = Report.objects.create(**validated_data)

        from apps.reports.models import ReportIdentity
        ReportIdentity.objects.create(
            report=report,
            encrypted_reporter_ref=f"PLACEHOLDER_{user.id}" if user else "PLACEHOLDER_ANONYMOUS"
        )

        for file in evidence_files:
            file_type = self._get_file_type(file)
            Evidence.objects.create(report=report, file=file, file_type=file_type)

        return report

    def _get_file_type(self, file):
        content_type = getattr(file, 'content_type', '')
        if content_type.startswith('image/'):
            return 'image'
        elif content_type.startswith('video/'):
            return 'video'
        elif content_type.startswith('audio/'):
            return 'audio'
        return 'other'

class ReportUpdateStatusSerializer(serializers.Serializer):
    """Used for status updates by Security/ICT Admin."""
    status = serializers.ChoiceField(choices=Status.choices)

class ReportAssignSerializer(serializers.Serializer):
    """Used for assignment by Security/ICT Admin."""
    assigned_to = serializers.UUIDField()

    def validate_assigned_to(self, value):
        try:
            user = User.objects.get(id=value, role='security')
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found or not a Security Officer.")
        return user