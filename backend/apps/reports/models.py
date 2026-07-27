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
    location_accuracy = models.FloatField(null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_reports',
        limit_choices_to={'role': 'security'}
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
        ]
    def __str__(self):
        return f"Report {self.id} - {self.status}"

class ReportIdentity(BaseModel):
    report = models.OneToOneField(Report, on_delete=models.CASCADE, related_name='identity')
    encrypted_reporter_ref = models.TextField()   # encrypted token linking to real user
    # Key held only by escrow role; not accessible in normal serializers
    reporter_hash = models.CharField(max_length=64, blank=True, null=True)
    # One-way HMAC of the reporter's user id (EncryptionService.hash_for_lookup),
    # used only to answer "is this my report" without decrypting encrypted_reporter_ref.

    class Meta:
        db_table = 'report_identities'
        indexes = [
            models.Index(fields=['reporter_hash']),
        ]

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