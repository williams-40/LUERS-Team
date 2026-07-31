import pytest
from unittest.mock import patch
from apps.notifications.services import NotificationService
from apps.core.factories import ReportFactory, UserFactory
from apps.core.choices import Channel


@pytest.mark.django_db
def test_dispatch_raises_for_unsupported_channel():
    report = ReportFactory()
    with pytest.raises(ValueError, match='Unsupported channel'):
        NotificationService.dispatch(report, 'carrier_pigeon')


@pytest.mark.django_db
def test_send_sms_skipped_when_recipient_has_no_phone_number():
    report = ReportFactory()
    recipient = UserFactory(phone_number=None)

    with patch('apps.notifications.services.send_sms_task') as mock_task:
        result = NotificationService.dispatch(report, Channel.SMS, recipient=recipient)

    assert result == {'status': 'skipped', 'reason': 'No phone number'}
    mock_task.delay.assert_not_called()


@pytest.mark.django_db
def test_send_sms_skipped_when_no_recipient_given():
    report = ReportFactory()
    with patch('apps.notifications.services.send_sms_task') as mock_task:
        result = NotificationService.dispatch(report, Channel.SMS, recipient=None)

    assert result == {'status': 'skipped', 'reason': 'No phone number'}
    mock_task.delay.assert_not_called()


@pytest.mark.django_db
def test_send_email_skipped_when_recipient_has_no_email():
    report = ReportFactory()
    recipient = UserFactory(email='')

    with patch('apps.notifications.services.send_email_task') as mock_task:
        result = NotificationService.dispatch(report, Channel.EMAIL, recipient=recipient)

    assert result == {'status': 'skipped', 'reason': 'No email'}
    mock_task.delay.assert_not_called()


@pytest.mark.django_db
def test_broadcast_report_created_sends_created_event_over_websocket():
    report = ReportFactory()
    with patch('apps.notifications.services.async_to_sync') as mock_async_to_sync:
        result = NotificationService.broadcast_report_created(report)

    assert result == {'status': 'sent', 'channel': 'websocket'}
    # Called once per group_send (general 'reports' group + this report's own group).
    assert mock_async_to_sync.call_count == 2
    first_call_payload = mock_async_to_sync.return_value.call_args_list[0].args[1]
    assert first_call_payload['type'] == 'report_created'


@pytest.mark.django_db
def test_broadcast_report_updated_sends_updated_event_over_websocket():
    report = ReportFactory()
    with patch('apps.notifications.services.async_to_sync') as mock_async_to_sync:
        result = NotificationService.broadcast_report_updated(report)

    assert result == {'status': 'sent', 'channel': 'websocket'}
    first_call_payload = mock_async_to_sync.return_value.call_args_list[0].args[1]
    assert first_call_payload['type'] == 'report_updated'
