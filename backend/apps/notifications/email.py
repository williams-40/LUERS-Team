from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_email(recipient_email, subject, message):
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                fail_silently=False,
            )
            logger.info(f"[EMAIL] Sent to {recipient_email}")
            return {'status': 'sent'}
        except Exception as e:
            logger.error(f"[EMAIL] Failed: {str(e)}")
            return {'status': 'failed', 'error': str(e)}