from celery import shared_task
from django.conf import settings
from apps.notifications.sms import SMSService
from apps.notifications.email import EmailService


@shared_task(
    bind=True,
    max_retries=settings.NOTIFICATION_TASK_MAX_RETRIES,
    default_retry_delay=settings.NOTIFICATION_TASK_RETRY_DELAY,
)
def send_sms_task(self, phone_number, message):
    result = SMSService.send_sms(phone_number, message)
    if result['status'] == 'failed':
        raise self.retry(exc=Exception(result.get('error', 'SMS send failed')))
    return result


@shared_task(
    bind=True,
    max_retries=settings.NOTIFICATION_TASK_MAX_RETRIES,
    default_retry_delay=settings.NOTIFICATION_TASK_RETRY_DELAY,
)
def send_email_task(self, recipient_email, subject, message):
    result = EmailService.send_email(recipient_email, subject, message)
    if result['status'] == 'failed':
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))
    return result
