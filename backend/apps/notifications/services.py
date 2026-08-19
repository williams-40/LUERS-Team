from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.reports.serializers import ReportListSerializer
from apps.core.choices import Channel
from apps.notifications.models import Notification
from apps.notifications.tasks import send_sms_task, send_email_task
import logging

logger = logging.getLogger(__name__)

class NotificationService:
    @staticmethod
    def dispatch(report, channel, recipient=None, **kwargs):
        if channel == Channel.WEBSOCKET:
            return NotificationService._send_websocket(report, **kwargs)
        elif channel == Channel.SMS:
            return NotificationService._send_sms(report, recipient, **kwargs)
        elif channel == Channel.EMAIL:
            return NotificationService._send_email(report, recipient, **kwargs)
        else:
            raise ValueError(f"Unsupported channel: {channel}")

    @staticmethod
    def _send_websocket(report, **kwargs):
        channel_layer = get_channel_layer()
        serializer = ReportListSerializer(report, context={'request': None})
        event_type = 'report_created' if kwargs.get('event_type') == 'created' else 'report_updated'
        payload = {'type': event_type, 'data': serializer.data}
        # Admin-tier dashboard/queue group, plus this report's own group —
        # without the latter, a non-admin reporter watching their own report
        # (via ws/reports/?report_id=...) never sees a live update, since
        # they're never a member of 'reports'.
        async_to_sync(channel_layer.group_send)('reports', payload)
        async_to_sync(channel_layer.group_send)(f'report_{report.id}', payload)
        logger.info(f"[WebSocket] Broadcast sent for report {report.id}")
        return {'status': 'sent', 'channel': 'websocket'}

    @staticmethod
    def _send_sms(report, recipient, **kwargs):
        if not recipient or not getattr(recipient, 'phone_number', None):
            logger.warning(f"[SMS] No phone number for {recipient}")
            return {'status': 'skipped', 'reason': 'No phone number'}

        short_id = str(report.id)[:8]
        if kwargs.get('event_type') == 'panic_created':
            emergency_type = getattr(getattr(report, 'emergency_dispatch', None), 'emergency_type', None)
            message = (
                f"LUERS EMERGENCY #{short_id}: {emergency_type or 'panic'} report just filed"
                f"{f' ({report.department.name})' if report.department else ''}"
                f" at {report.created_at.strftime('%H:%M')}. Respond in LUERS now."
            )
        else:
            message = f"LUERS Alert: New report #{short_id} - {report.category} at {report.created_at.strftime('%H:%M')}"

        # Creates a real Notification row for SMS (unlike before this
        # redesign, when SMS/email dispatch was invisible in the DB beyond a
        # discarded Celery return dict) — the task itself flips its status
        # to sent/failed once the send actually resolves.
        notification = Notification.objects.create(recipient=recipient, report=report, channel=Channel.SMS)
        send_sms_task.delay(recipient.phone_number, message, str(notification.id))
        return {'status': 'queued', 'notification_id': str(notification.id)}

    @staticmethod
    def _send_email(report, recipient, **kwargs):
        if not recipient or not getattr(recipient, 'email', None):
            logger.warning(f"[EMAIL] No email for {recipient}")
            return {'status': 'skipped', 'reason': 'No email'}

        short_id = str(report.id)[:8]
        if kwargs.get('event_type') == 'assigned':
            subject = f"LUERS Alert: You've been assigned Report #{short_id}"
            message = f"""
You've been assigned a report on LUERS.

Report ID: {report.id}
Category: {report.category}
Status: {report.status}
Description: {report.description[:200]}...

Please login to LUERS to view and respond.
"""
        elif kwargs.get('event_type') == 'panic_created':
            emergency_type = getattr(getattr(report, 'emergency_dispatch', None), 'emergency_type', None)
            subject = f"LUERS EMERGENCY: New {emergency_type or 'panic'} report #{short_id}"
            message = f"""
An emergency report was just filed and routed to your department.

Report ID: {report.id}
Emergency type: {emergency_type or 'unspecified'}
Department: {report.department.name if report.department else 'Unassigned'}
Description: {(report.description or '(none provided)')[:200]}
Filed: {report.created_at}

Please login to LUERS immediately to acknowledge and respond.
"""
        else:
            subject = f"LUERS Alert: New Report #{short_id}"
            message = f"""
A new report has been submitted.

Report ID: {report.id}
Category: {report.category}
Status: {report.status}
Description: {report.description[:200]}...
Created: {report.created_at}

Please login to LUERS for more details.
"""
        notification = Notification.objects.create(recipient=recipient, report=report, channel=Channel.EMAIL)
        send_email_task.delay(recipient.email, subject, message, str(notification.id))
        return {'status': 'queued', 'notification_id': str(notification.id)}

    @staticmethod
    def broadcast_report_created(report):
        return NotificationService.dispatch(report, Channel.WEBSOCKET, event_type='created')

    @staticmethod
    def broadcast_report_updated(report):
        return NotificationService.dispatch(report, Channel.WEBSOCKET, event_type='updated')