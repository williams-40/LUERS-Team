from twilio.rest import Client
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class SMSService:
    @staticmethod
    def send_sms(phone_number, message):
        try:
            account_sid = settings.TWILIO_ACCOUNT_SID
            auth_token = settings.TWILIO_AUTH_TOKEN
            from_number = settings.TWILIO_PHONE_NUMBER

            client = Client(account_sid, auth_token)
            message = client.messages.create(
                body=message,
                from_=from_number,
                to=phone_number
            )
            logger.info(f"[SMS] Sent to {phone_number}, SID: {message.sid}")
            return {'status': 'sent', 'sid': message.sid}
        except Exception as e:
            logger.error(f"[SMS] Failed: {str(e)}")
            return {'status': 'failed', 'error': str(e)}
            