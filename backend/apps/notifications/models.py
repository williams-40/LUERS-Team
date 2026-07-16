from django.db import models
from django.conf import settings
from apps.core.choices import Channel
from apps.core.models import BaseModel

class Notification(BaseModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    report = models.ForeignKey('reports.Report', on_delete=models.CASCADE, related_name='notifications')
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.WEBSOCKET)
    sent_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        indexes = [
            models.Index(fields=['recipient']),
            models.Index(fields=['report']),
            models.Index(fields=['channel']),
            models.Index(fields=['sent_at']),
        ]

    def __str__(self):
        return f"Notification for {self.recipient_id} on Report {self.report_id}"