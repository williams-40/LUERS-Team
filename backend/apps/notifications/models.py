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


class Message(BaseModel):
    """A message in a conversation thread attached to a report."""
    report = models.ForeignKey(
        'reports.Report',
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    content = models.TextField()
    # Optional: message_type = models.CharField(max_length=20, choices=..., default='text')
    # We'll keep it simple for now.

    class Meta:
        db_table = 'messages'
        indexes = [
            models.Index(fields=['report', 'created_at']),
            models.Index(fields=['sender']),
        ]
        ordering = ['created_at']

    def __str__(self):
        return f"Message {self.id} on Report {self.report_id} by {self.sender.username}"