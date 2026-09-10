from django.db import models
from django.conf import settings
from apps.core.choices import Category, Urgency, Status, FileType
from apps.core.models import BaseModel

class Report(BaseModel):
    # Legacy incident-type classifier — retired as of the department-routing
    # rework (Phase 14). Existing reports keep their value as read-only
    # history; new reports leave this null and use `department` instead.
    category = models.CharField(max_length=20, choices=Category.choices, null=True, blank=True)
    description = models.TextField()   # stored raw for future NLP
    urgency = models.CharField(max_length=10, choices=Urgency.choices, default=Urgency.NORMAL)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.NEW)
    # The authenticated user who filed this report — replaces the old
    # encrypted ReportIdentity table now that anonymous reporting has been
    # removed. SET_NULL (not PROTECT) so deleting a user account doesn't
    # block deleting/keeping their historical reports, matching assigned_to
    # and department's existing on_delete behavior on this model.
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_reports',
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_accuracy = models.FloatField(null=True, blank=True)
    # Responders are department members now, not a fixed Role — see
    # apps.reports.services.is_department_head_or_system_admin and
    # ReportAssignSerializer for the real (department-membership) check.
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_reports',
    )
    metadata = models.JSONField(default=dict, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Offline support
    idempotency_key = models.CharField(max_length=64, unique=True, null=True, blank=True)
    client_created_at = models.DateTimeField(null=True, blank=True)

    # ✅ New department fields
    department = models.ForeignKey(
        'Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reports'
    )
    custom_department = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'reports'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['category']),
            models.Index(fields=['urgency']),
            models.Index(fields=['created_at']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['idempotency_key']),
            models.Index(fields=['department']),  # for performance
            models.Index(fields=['reporter']),
        ]
    def __str__(self):
        return f"Report {self.id} - {self.status}"

class Evidence(BaseModel):
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='evidence')
    file = models.FileField(upload_to='evidence/%Y/%m/%d/')
    file_type = models.CharField(max_length=10, choices=FileType.choices)

    class Meta:
        db_table = 'evidence'

    def __str__(self):
        return f"Evidence for Report {self.report_id}"

class Department(BaseModel):
    """Department entity for routing reports."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='departments_headed'
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='department_members',
        blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'departments'
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class EmergencyCategory(BaseModel):
    """
    Admin-manageable replacement for the old fixed EmergencyType enum —
    what used to be a hardcoded Python choice list (security/medical/fire/
    accident/other) is now real rows a system_admin can add to, edit, or
    deactivate without a code deploy. `slug` is the stable identifier
    stored on EmergencyDispatch.emergency_type (a plain string, not an FK —
    see that field's own comment for why).
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True)
    # The category's own deterministic routing default — nullable/SET_NULL
    # exactly like Report.department, so deleting a department orphans a
    # category's default rather than erroring or cascading.
    department = models.ForeignKey(
        'Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='emergency_categories'
    )
    # Explicit, admin-settable — deliberately NOT inferred from whether
    # `department` is set. Even "Other" has a real fallback department
    # ("Security") today; this flag is about whether a description is
    # mandatory and worth running DepartmentRoutingService's keyword
    # matching against, which is a different question from "does this
    # category have a default department at all."
    requires_description_and_routing = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    # Controls picker display order — dict/enum ordering isn't guaranteed
    # to match admin intent once categories can be added/removed freely.
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'emergency_categories'
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
            models.Index(fields=['sort_order']),
        ]

    def __str__(self):
        return self.name


class EmergencyDispatch(BaseModel):
    """
    Emergency-only lifecycle state for a panic Report, kept off the base
    Report row (same 1:1 extension pattern as ReportFeedback) since these
    fields are meaningless for the ~all normal reports that never need them.
    Created once, in the same transaction as the Report, for every
    urgency='panic' report — see ReportService.create_report.
    """
    report = models.OneToOneField(Report, on_delete=models.CASCADE, related_name='emergency_dispatch')
    # A plain string (the matching EmergencyCategory.slug at the time this
    # was created), not an FK — AuditLog.after_state and the frontend both
    # already treat this as a bare string on the wire, and `choices=` (fixed
    # at deploy time) is incompatible with admin-added categories.
    emergency_type = models.CharField(max_length=30, default='other')
    # A snapshot of the category's name, taken once at creation — so a
    # historical report still displays correctly even if that category is
    # later renamed or deleted. Never updated after creation.
    emergency_type_label = models.CharField(max_length=100, blank=True, default='')
    escalation_level = models.PositiveSmallIntegerField(default=0)

    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_emergencies'
    )
    responding_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='cancelled_emergencies'
    )

    # Computed once at creation from settings.EMERGENCY_SLA_MINUTES so the
    # Celery Beat escalation scanner never has to recompute them per tick.
    ack_deadline = models.DateTimeField(null=True, blank=True)
    response_deadline = models.DateTimeField(null=True, blank=True)
    resolution_deadline = models.DateTimeField(null=True, blank=True)
    last_escalated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'emergency_dispatches'
        indexes = [
            models.Index(fields=['emergency_type']),
            models.Index(fields=['ack_deadline']),
            models.Index(fields=['response_deadline']),
            models.Index(fields=['resolution_deadline']),
        ]

    def __str__(self):
        return f"EmergencyDispatch for Report {self.report_id} ({self.emergency_type})"


class ReportFeedback(BaseModel):
    """Reporter feedback captured after a report is Resolved — see ReportService.submit_feedback."""
    report = models.OneToOneField(Report, on_delete=models.CASCADE, related_name='feedback')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='submitted_feedback'
    )
    rating = models.PositiveSmallIntegerField()
    comments = models.TextField(blank=True)

    class Meta:
        db_table = 'report_feedback'

    def __str__(self):
        return f"Feedback for Report {self.report_id} ({self.rating}/5)"