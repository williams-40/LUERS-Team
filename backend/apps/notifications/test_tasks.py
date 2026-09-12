import pytest
from unittest.mock import patch
from apps.notifications.tasks import send_sms_task, send_email_task
from apps.notifications.services import NotificationService
from apps.core.factories import ReportFactory, UserFactory
from apps.core.choices import Channel


def test_send_sms_task_success():
    with patch('apps.notifications.tasks.SMSService.send_sms', return_value={'status': 'sent', 'sid': 'SM123'}) as mock_send:
        result = send_sms_task.apply(args=('+256700000000', 'test message')).get()
    assert result['status'] == 'sent'
    mock_send.assert_called_once_with('+256700000000', 'test message')


def test_send_email_task_success():
    with patch('apps.notifications.tasks.EmailService.send_email', return_value={'status': 'sent'}) as mock_send:
        result = send_email_task.apply(args=('user@example.com', 'Subject', 'Body')).get()
    assert result['status'] == 'sent'
    mock_send.assert_called_once_with('user@example.com', 'Subject', 'Body')


def test_send_sms_task_raises_when_send_fails():
    with patch('apps.notifications.tasks.SMSService.send_sms', return_value={'status': 'failed', 'error': 'boom'}):
        with pytest.raises(Exception):
            send_sms_task.apply(args=('+256700000000', 'test message')).get()


def test_send_email_task_raises_when_send_fails():
    with patch('apps.notifications.tasks.EmailService.send_email', return_value={'status': 'failed', 'error': 'boom'}):
        with pytest.raises(Exception):
            send_email_task.apply(args=('user@example.com', 'Subject', 'Body')).get()


@pytest.mark.django_db
def test_notification_service_dispatches_sms_via_celery():
    report = ReportFactory()
    recipient = UserFactory(phone_number='+256700000001')

    with patch('apps.notifications.services.send_sms_task') as mock_task:
        result = NotificationService.dispatch(report, Channel.SMS, recipient=recipient)

    assert result['status'] == 'queued'
    mock_task.delay.assert_called_once()


@pytest.mark.django_db
def test_notification_service_dispatches_email_via_celery():
    report = ReportFactory()
    recipient = UserFactory()

    with patch('apps.notifications.services.send_email_task') as mock_task:
        result = NotificationService.dispatch(report, Channel.EMAIL, recipient=recipient)

    assert result['status'] == 'queued'
    mock_task.delay.assert_called_once()
