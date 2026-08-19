import pytest
from django.core import mail
from django.test import override_settings
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, DepartmentFactory, DepartmentHeadFactory
from apps.reports.models import Report, EmergencyDispatch
from apps.notifications.models import Notification


@pytest.mark.django_db
def test_panic_report_creation_without_department_or_description_succeeds():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'security',
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == security.id
    assert report.description == ''


@pytest.mark.django_db
def test_panic_report_requires_emergency_type():
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {'urgency': 'panic'})

    assert response.status_code == 400
    assert 'emergency_type' in response.data


@pytest.mark.django_db
def test_normal_report_still_requires_department_and_description():
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {'urgency': 'normal'})

    assert response.status_code == 400
    assert 'department' in response.data
    assert 'description' in response.data


@pytest.mark.parametrize(
    'emergency_type,department_name',
    [
        ('security', 'Security'),
        ('medical', 'Health & Safety'),
        ('fire', 'Health & Safety'),
        ('accident', 'Health & Safety'),
        ('other', 'Security'),
    ],
)
@pytest.mark.django_db
def test_panic_emergency_type_routes_deterministically(emergency_type, department_name):
    student = UserFactory(role='student')
    DepartmentFactory(name='Security')
    DepartmentFactory(name='Health & Safety')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': emergency_type,
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department.name == department_name


@pytest.mark.django_db
def test_panic_creation_populates_emergency_dispatch_with_sla_deadlines():
    student = UserFactory(role='student')
    DepartmentFactory(name='Security')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'security',
    })

    assert response.status_code == 201, response.data
    dispatch = EmergencyDispatch.objects.get(report_id=response.data['id'])
    assert dispatch.emergency_type == 'security'
    assert dispatch.escalation_level == 0
    assert dispatch.acknowledged_at is None
    assert dispatch.ack_deadline is not None
    assert dispatch.response_deadline > dispatch.ack_deadline
    assert dispatch.resolution_deadline > dispatch.response_deadline


@pytest.mark.django_db
def test_normal_report_never_gets_an_emergency_dispatch_row():
    student = UserFactory(role='student')
    department = DepartmentFactory(name='Library')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'normal',
        'department': str(department.id),
        'description': 'The book return slot is jammed shut',
    })

    assert response.status_code == 201, response.data
    assert not EmergencyDispatch.objects.filter(report_id=response.data['id']).exists()


@pytest.mark.django_db(transaction=True)
def test_panic_creation_emails_department_head():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    # No phone_number set — keeps this test off the real-Twilio-client SMS
    # path (empty credentials in the test environment would raise, not just
    # fail gracefully, since Celery runs tasks eagerly with propagation on).
    head = DepartmentHeadFactory()
    security.head = head
    security.save(update_fields=['head'])

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'security',
    })

    assert response.status_code == 201, response.data
    report_id = response.data['id']
    assert any('EMERGENCY' in m.subject for m in mail.outbox)

    email_notification = Notification.objects.get(report_id=report_id, recipient=head, channel='email')
    assert email_notification.status == 'sent'


@pytest.mark.django_db
@override_settings(RATELIMIT_ENABLE=True)
def test_exhausting_normal_rate_limit_does_not_block_panic():
    student = UserFactory(role='student')
    department = DepartmentFactory(name='Library')
    DepartmentFactory(name='Security')

    client = APIClient()
    client.force_authenticate(user=student)

    for _ in range(5):
        response = client.post('/api/v1/reports/create/', {
            'urgency': 'normal',
            'department': str(department.id),
            'description': 'Routine report to burn through the normal quota',
        })
        assert response.status_code == 201, response.data

    # 6th normal report in the same window is rate-limited.
    blocked = client.post('/api/v1/reports/create/', {
        'urgency': 'normal',
        'department': str(department.id),
        'description': 'This one should be blocked by the normal-report quota',
    })
    assert blocked.status_code == 403

    # A panic report from the same user, same window, is a separate bucket.
    panic_response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'security',
    })
    assert panic_response.status_code == 201, panic_response.data
