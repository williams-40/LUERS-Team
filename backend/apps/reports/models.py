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


class AssistanceRequest(BaseModel):
    """
    A responder (or department head/System Admin) asking one or more other
    departments to help on a report they're still the owner of — the
    requesting department keeps the report, assisting departments just gain
    visibility into it (see apps.reports.services.get_accessible_reports).
    """
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='assistance_requests')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='assistance_requests_made'
    )
    reason = models.TextField()
    departments = models.ManyToManyField(Department, related_name='assistance_requests')

    class Meta:
        db_table = 'assistance_requests'

    def __str__(self):
        return f"Assistance request for Report {self.report_id}"


class AssistanceAcknowledgement(BaseModel):
    """One acknowledgement per department per request — records the first responder from that department to respond."""
    assistance_request = models.ForeignKey(AssistanceRequest, on_delete=models.CASCADE, related_name='acknowledgements')
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    acknowledged_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = 'assistance_acknowledgements'
        unique_together = ('assistance_request', 'department')

    def __str__(self):
        return f"Ack for {self.assistance_request_id} by {self.department_id}"


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