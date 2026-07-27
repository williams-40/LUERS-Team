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
    # ✅ Department fields
    department_id = serializers.UUIDField(source='department.id', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = Report
        fields = [
            'id', 'category', 'category_display', 'description', 'urgency', 'urgency_display',
            'status', 'status_display', 'latitude', 'longitude', 'location_accuracy',
            'assigned_to', 'assigned_to_username', 'is_anonymous', 'created_at', 'updated_at',
            'evidence_count',
            'department_id', 'department_name',  # ✅ new fields
        ]


class ReportDetailSerializer(serializers.ModelSerializer):
    """Used for detail view - includes evidence and audit trail (optional)."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    urgency_display = serializers.CharField(source='get_urgency_display', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    evidence = EvidenceSerializer(many=True, read_only=True)
    # ✅ Department fields
    department_id = serializers.UUIDField(source='department.id', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = Report
        fields = [
            'id', 'category', 'category_display', 'description', 'urgency', 'urgency_display',
            'status', 'status_display', 'latitude', 'longitude', 'location_accuracy',
            'assigned_to', 'assigned_to_username', 'is_anonymous', 'metadata', 'created_at', 'updated_at',
            'evidence',
            'department_id', 'department_name',  # ✅ new fields
        ]


class ReportCreateSerializer(serializers.ModelSerializer):
    """
    Used for report submission - supports evidence upload in the same request (optional).
    Evidence can also be added later via POST /api/v1/reports/{id}/evidence/.
    """
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
            'evidence',
            # Offline support
            'idempotency_key',
            'client_created_at',
            # Department routing
            'custom_department',   # only used when category == 'other'
        ]
        read_only_fields = ['id', 'status', 'created_at']
        extra_kwargs = {
            'category': {'required': True},
            'description': {'required': True},
            'idempotency_key': {'required': False, 'allow_blank': True, 'max_length': 64},
            'client_created_at': {'required': False, 'allow_null': True},
            'custom_department': {'required': False, 'allow_blank': True, 'max_length': 200},
        }

    def validate(self, attrs):
        category = attrs.get('category')
        custom_dept = attrs.get('custom_department', '').strip()

        if category == Category.OTHER and not custom_dept:
            raise serializers.ValidationError({
                'custom_department': 'Please specify a department when selecting "Other".'
            })
        return attrs

    def create(self, validated_data):
        evidence_files = validated_data.pop('evidence', [])
        validated_data.setdefault('urgency', 'normal')

        request = self.context.get('request')
        user = request.user if request else None

        report = Report.objects.create(**validated_data)

        if user:
            from apps.reports.services import IdentityService
            IdentityService.create_identity(report, user)

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
    expected_updated_at = serializers.DateTimeField(required=False, allow_null=True)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)


class ReportAssignSerializer(serializers.Serializer):
    """Used for assignment by Security/ICT Admin."""
    assigned_to = serializers.UUIDField()
    expected_updated_at = serializers.DateTimeField(required=False, allow_null=True)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)

    def validate_assigned_to(self, value):
        try:
            user = User.objects.get(id=value, role='security')
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found or not a Security Officer.")
        return user


class SyncActionSerializer(serializers.Serializer):
    """Serializer for a single sync action."""
    action = serializers.ChoiceField(choices=['create_report', 'update_status', 'send_message'])
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=64)
    client_created_at = serializers.DateTimeField(required=False, allow_null=True)
    report_id = serializers.UUIDField(required=False, allow_null=True)
    data = serializers.JSONField(required=True)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        action = attrs.get('action')
        data = attrs.get('data', {})
        report_id = attrs.get('report_id')

        if action == 'create_report':
            required = ['category', 'description']
            for field in required:
                if field not in data:
                    raise serializers.ValidationError(f"Missing required field '{field}' for create_report")
            # Optional: validate custom_department if category is 'other'
            category = data.get('category')
            custom_dept = data.get('custom_department', '').strip()
            if category == Category.OTHER and not custom_dept:
                raise serializers.ValidationError(
                    "custom_department is required when category is 'other' for create_report"
                )
        elif action == 'update_status':
            if not report_id:
                raise serializers.ValidationError("report_id is required for update_status")
            if 'status' not in data:
                raise serializers.ValidationError("Missing 'status' for update_status")
            if data['status'] not in dict(Status.choices):
                raise serializers.ValidationError(
                    f"Invalid status. Choose from {list(dict(Status.choices).keys())}"
                )
        elif action == 'send_message':
            if not report_id:
                raise serializers.ValidationError("report_id is required for send_message")
            if 'content' not in data:
                raise serializers.ValidationError("Missing 'content' for send_message")
            if len(data.get('content', '')) > 2000:
                raise serializers.ValidationError("content too long (max 2000 characters)")
        return attrs


class SyncRequestSerializer(serializers.Serializer):
    actions = SyncActionSerializer(many=True, required=True)


class SyncResultSerializer(serializers.Serializer):
    action = serializers.CharField()
    status = serializers.ChoiceField(choices=['success', 'error'])
    data = serializers.JSONField(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)