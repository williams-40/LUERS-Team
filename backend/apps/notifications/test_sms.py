from unittest.mock import MagicMock, patch
from django.conf import settings
from apps.notifications.sms import SMSService


def test_send_sms_success_returns_sid():
    fake_message = MagicMock(sid='SM123')
    with patch('apps.notifications.sms.Client') as MockClient:
        MockClient.return_value.messages.create.return_value = fake_message
        result = SMSService.send_sms('+256700000000', 'hello')

    assert result == {'status': 'sent', 'sid': 'SM123'}
    MockClient.return_value.messages.create.assert_called_once_with(
        body='hello', from_=settings.TWILIO_PHONE_NUMBER, to='+256700000000',
    )


def test_send_sms_failure_returns_error_status():
    with patch('apps.notifications.sms.Client') as MockClient:
        MockClient.return_value.messages.create.side_effect = Exception('network down')
        result = SMSService.send_sms('+256700000000', 'hello')

    assert result['status'] == 'failed'
    assert result['error'] == 'network down'
