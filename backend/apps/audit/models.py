from django.db import models
from django.conf import settings
from apps.core.choices import Action, SyncOrigin  # ✅ added SyncOrigin
from apps.core.models import BaseModel

class AuditLog(BaseModel):
    # SET_NULL, not CASCADE: a permanent-delete's own audit entry (and this
    # report's whole prior history) must survive the report row itself
    # being gone — that's the point of logging the deletion at all. The
    # retention-window purge (purge_deleted_reports) relies on this too,
    # now leaving its own audit trail behind instead of erasing it.
    report = models.ForeignKey('reports.Report', on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_actions')
    action = models.CharField(max_length=30, choices=Action.choices)
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    # Raw User-Agent header — paired with ip_address as "accessed from"
    # context in the audit log UI, since true geolocation isn't reliable for
    # private/LAN IPs (see AuditLogPage.tsx). Nullable like ip_address for
    # the same reason: system-triggered entries (e.g. the Celery Beat SLA
    # auto-escalation in EmergencyDispatchService.escalate) have no request
    # to pull either one from.
    user_agent = models.CharField(max_length=255, null=True, blank=True, default='')
    client_timestamp = models.DateTimeField(null=True, blank=True)  # Client‑reported time of the action
    sync_origin = models.CharField(max_length=10, choices=SyncOrigin.choices, default=SyncOrigin.LIVE)  # ✅ new field

    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['report']),
            models.Index(fields=['actor']),
            models.Index(fields=['action']),
            models.Index(fields=['created_at']),
            models.Index(fields=['client_timestamp']),
            models.Index(fields=['sync_origin']),  # ✅ for filtering by sync origin
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} on {self.report_id} by {self.actor_id} ({self.sync_origin})"  # ✅ include sync_origin