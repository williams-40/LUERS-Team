from celery import shared_task
from django.conf import settings
from apps.notifications.sms import SMSService
from apps.notifications.email import EmailService


def _record_delivery(notification_id, status):
    # notification_id is only passed by NotificationService's report-related
    # dispatch (apps.notifications.services) — other call sites (password
    # reset, account-invite emails in apps.accounts.services) don't create a
    # Notification row at all, so this is a no-op for them.
    if not notification_id:
        return
    from apps.notifications.models import Notification
    Notification.objects.filter(id=notification_id).update(status=status)


@shared_task(
    bind=True,
    max_retries=settings.NOTIFICATION_TASK_MAX_RETRIES,
    default_retry_delay=settings.NOTIFICATION_TASK_RETRY_DELAY,
)
def send_sms_task(self, phone_number, message, notification_id=None):
    result = SMSService.send_sms(phone_number, message)
    if result['status'] == 'failed':
        _record_delivery(notification_id, 'failed')
        raise self.retry(exc=Exception(result.get('error', 'SMS send failed')))
    _record_delivery(notification_id, 'sent')
    return result


@shared_task(
    bind=True,
    max_retries=settings.NOTIFICATION_TASK_MAX_RETRIES,
    default_retry_delay=settings.NOTIFICATION_TASK_RETRY_DELAY,
)
def send_email_task(self, recipient_email, subject, message, notification_id=None):
    result = EmailService.send_email(recipient_email, subject, message)
    if result['status'] == 'failed':
        _record_delivery(notification_id, 'failed')
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))
    _record_delivery(notification_id, 'sent')
    return result
