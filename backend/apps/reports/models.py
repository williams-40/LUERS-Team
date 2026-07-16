from django.db import models
from django.conf import settings
from apps.core.choices import Category, Urgency, Status, FileType
from apps.core.models import BaseModel

class Report(BaseModel):
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField()   # stored raw for future NLP
    urgency = models.CharField(max_length=10, choices=Urgency.choices, default=Urgency.NORMAL)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.NEW)
    is_anonymous = models.BooleanField(default=False)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_accuracy = models.FloatField(null=True, blank=True)  # meters
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_reports',
        limit_choices_to={'role': 'security'}   # only security can be assigned
    )
    metadata = models.JSONField(default=dict, blank=True)  # AI readiness
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'reports'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['category']),
            models.Index(fields=['urgency']),
            models.Index(fields=['created_at']),
            models.Index(fields=['assigned_to']),
        ]

    def __str__(self):
        return f"Report {self.id} - {self.status}"

class ReportIdentity(BaseModel):
    report = models.OneToOneField(Report, on_delete=models.CASCADE, related_name='identity')
    encrypted_reporter_ref = models.TextField()   # encrypted token linking to real user
    # Key held only by escrow role; not accessible in normal serializers

    class Meta:
        db_table = 'report_identities'

    def __str__(self):
        return f"Identity for Report {self.report_id}"

class Evidence(BaseModel):
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='evidence')
    file = models.FileField(upload_to='evidence/%Y/%m/%d/')
    file_type = models.CharField(max_length=10, choices=FileType.choices)

    class Meta:
        db_table = 'evidence'

    def __str__(self):
        return f"Evidence for Report {self.report_id}"
