from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.reports.models import Report, Evidence, Department, EmergencyDispatch
from apps.core.choices import Urgency, Status, EmergencyType
from apps.reports.validators import validate_evidence_file

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


class EmergencyDispatchSerializer(serializers.ModelSerializer):
    emergency_type_display = serializers.CharField(source='get_emergency_type_display', read_only=True)
    acknowledged_by_username = serializers.CharField(source='acknowledged_by.username', read_only=True, default=None)

    class Meta:
        model = EmergencyDispatch
        fields = [
            'emergency_type', 'emergency_type_display', 'escalation_level',
            'acknowledged_at', 'acknowledged_by_username', 'responding_at', 'arrived_at',
            'resolved_at', 'cancelled_at',
            'ack_deadline', 'response_deadline', 'resolution_deadline',
        ]


class ReportListSerializer(serializers.ModelSerializer):
    """Used for list views (officer dashboard) - hides reporter identity."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    urgency_display = serializers.CharField(source='get_urgency_display', read_only=True)
    # Explicit UUIDField (not the ModelSerializer-inferred PrimaryKeyRelatedField)
    # so `.data` holds a plain str — PrimaryKeyRelatedField.to_representation
    # returns the raw UUID object, which json.dumps() in ReportConsumer can't
    # serialize (DRF's own renderer would have handled it, but the WS
    # broadcast path calls json.dumps directly on `.data`).
    assigned_to = serializers.UUIDField(source='assigned_to_id', read_only=True, default=None)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    evidence_count = serializers.IntegerField(source='evidence.count', read_only=True)
    # ✅ Department fields
    department_id = serializers.UUIDField(source='department.id', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    # Lets the frontend decide whether the *viewer* is this report's
    # department head (assign authority) without a separate lookup.
    department_head_id = serializers.UUIDField(source='department.head_id', read_only=True, default=None)
    emergency_dispatch = EmergencyDispatchSerializer(read_only=True, default=None)

    class Meta:
        model = Report
        fields = [
            'id', 'category', 'category_display', 'description', 'urgency', 'urgency_display',
            'status', 'status_display', 'latitude', 'longitude', 'location_accuracy',
            'assigned_to', 'assigned_to_username', 'created_at', 'updated_at',
            'evidence_count', 'deleted_at',
            'department_id', 'department_name', 'department_head_id',
            'emergency_dispatch',
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
    department_head_id = serializers.UUIDField(source='department.head_id', read_only=True, default=None)
    # Already implicitly exposed via reporter_name/reporter_phone below to
    # the same audience — the frontend needs the bare id too, to decide
    # whether the *viewer themself* is the reporter (e.g. can they cancel
    # their own just-filed panic report).
    reporter = serializers.UUIDField(source='reporter_id', read_only=True, default=None)
    reporter_name = serializers.SerializerMethodField()
    reporter_phone = serializers.SerializerMethodField()
    emergency_dispatch = EmergencyDispatchSerializer(read_only=True, default=None)

    class Meta:
        model = Report
        fields = [
            'id', 'category', 'category_display', 'description', 'urgency', 'urgency_display',
            'status', 'status_display', 'latitude', 'longitude', 'location_accuracy',
            'assigned_to', 'assigned_to_username', 'metadata', 'created_at', 'updated_at',
            'evidence',
            'department_id', 'department_name', 'department_head_id',
            'reporter', 'reporter_name', 'reporter_phone',
            'emergency_dispatch',
        ]

    def get_reporter_name(self, obj):
        user = obj.reporter
        if not user:
            return None
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    def get_reporter_phone(self, obj):
        return obj.reporter.phone_number if obj.reporter else None


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

    # Required for a normal report; not required for panic (routed
    # deterministically from emergency_type instead — see validate() and
    # ReportService.create_report). A reporter mid-emergency should never
    # have to make a routing decision.
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True), required=False, allow_null=True
    )

    # Panic-only: which kind of emergency this is, used to deterministically
    # resolve `department` (settings.EMERGENCY_TYPE_DEPARTMENT_MAP) and to
    # populate the EmergencyDispatch row created alongside the Report. Not a
    # Report field — popped out in ReportService.create_report.
    emergency_type = serializers.ChoiceField(choices=EmergencyType.choices, required=False, allow_null=True)

    # Not a Report field — captured here only to optionally persist it onto
    # the reporter's own profile (see ReportService.create_report). Always
    # optional (Phase 2: no longer required for "non-anonymous" reports —
    # anonymous reporting itself is gone). Write-only, never echoed back.
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=15)

    class Meta:
        model = Report
        fields = [
            'id',
            'department',
            'emergency_type',
            'description',
            'urgency',
            'phone_number',
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
        ]
        # assigned_to is read-only here (not "required": {} — assignment
        # only ever happens via the dedicated assign endpoint). Before
        # Phase 14, `assigned_to`'s model-level limit_choices_to={'role':
        # 'security'} incidentally restricted what a reporter could set
        # here too; now that responders are department-membership-based
        # rather than role-based, that incidental restriction is gone, so
        # this must be explicit instead of relying on it.
        read_only_fields = ['id', 'status', 'created_at', 'assigned_to']
        extra_kwargs = {
            # Required for normal reports only — enforced in validate()
            # below, since a panic report may have nothing more to say than
            # the emergency type itself.
            'description': {'required': False, 'allow_blank': True},
            'idempotency_key': {'required': False, 'allow_blank': True, 'max_length': 64},
            'client_created_at': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        for file in attrs.get('evidence', []):
            try:
                validate_evidence_file(file)
            except ValueError as e:
                raise serializers.ValidationError({'evidence': str(e)})

        urgency = attrs.get('urgency') or Urgency.NORMAL
        errors = {}
        if urgency == Urgency.PANIC:
            if not attrs.get('emergency_type'):
                errors['emergency_type'] = 'Required for a panic report.'
        else:
            if attrs.get('department') is None:
                errors['department'] = 'This field is required.'
            if not (attrs.get('description') or '').strip():
                errors['description'] = 'This field is required.'
        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        # Note: the live create-report endpoint and the offline sync path
        # both bypass this method entirely — they call
        # apps.reports.services.ReportService.create_report directly from
        # validated_data (see ReportCreateView.perform_create / SyncView),
        # which is where reporter/phone-number handling actually lives.
        # Kept correct and self-consistent here anyway rather than left
        # referencing the removed identity system, since a serializer
        # conventionally needs a working create().
        evidence_files = validated_data.pop('evidence', [])
        validated_data.pop('phone_number', None)
        validated_data.setdefault('urgency', 'normal')

        request = self.context.get('request')
        user = request.user if request else None

        report = Report.objects.create(**validated_data, reporter=user)

        for file in evidence_files:
            # Already validated in validate() above; re-running here just to
            # get the classified file_type back (cheap — reads a few bytes).
            file_type = validate_evidence_file(file)
            Evidence.objects.create(report=report, file=file, file_type=file_type)

        return report


class ReportUpdateStatusSerializer(serializers.Serializer):
    """Used for status updates by Security/ICT Admin."""
    status = serializers.ChoiceField(choices=Status.choices)
    expected_updated_at = serializers.DateTimeField(required=False, allow_null=True)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)


class ReportLocationUpdateSerializer(serializers.Serializer):
    """Follow-up location for a report created before GPS resolved (the
    /emergency flow never awaits geolocation before submitting)."""
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    location_accuracy = serializers.FloatField(required=False, allow_null=True)


class ReportAssignSerializer(serializers.Serializer):
    """
    Used for assignment by a department head or System Admin. Only checks
    the user exists here — whether they're actually eligible (a member or
    head of the *target report's* department) needs the report instance,
    which this serializer doesn't have, so that check happens in the view
    (see ReportAssignView / apps.reports.services.assert_can_assign_to).
    """
    assigned_to = serializers.UUIDField()
    expected_updated_at = serializers.DateTimeField(required=False, allow_null=True)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)

    def validate_assigned_to(self, value):
        try:
            user = User.objects.get(id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")
        return user


class BulkStatusUpdateSerializer(serializers.Serializer):
    """Used for bulk status updates from the triage queue's selection toolbar."""
    report_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=100,
    )
    status = serializers.ChoiceField(choices=Status.choices)


class BulkAssignSerializer(serializers.Serializer):
    """Used for bulk assignment from the triage queue's selection toolbar."""
    report_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=100,
    )
    assigned_to = serializers.UUIDField()

    def validate_assigned_to(self, value):
        try:
            user = User.objects.get(id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")
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
            # Mirrors ReportCreateSerializer.validate()'s urgency-conditional
            # requirements — this is just an early, cheap pre-check ahead of
            # the real serializer validation in SyncView; department/
            # description stay required for normal reports, but a panic
            # report only needs emergency_type.
            if data.get('urgency') == Urgency.PANIC:
                if 'emergency_type' not in data:
                    raise serializers.ValidationError("Missing required field 'emergency_type' for create_report")
            else:
                for field in ['department', 'description']:
                    if field not in data:
                        raise serializers.ValidationError(f"Missing required field '{field}' for create_report")
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