import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ReportFactory
from apps.notifications.models import Message
from apps.reports.services import IdentityService


@pytest.mark.django_db
def test_list_messages_requires_authentication():
    report = ReportFactory()
    client = APIClient()
    response = client.get(f'/api/v1/reports/{report.id}/messages/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_tier_can_list_messages_for_any_report():
    report = ReportFactory()
    Message.objects.create(report=report, sender=SecurityFactory(), content='hello')

    security = SecurityFactory()
    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200
    assert response.data['results'][0]['content'] == 'hello'


@pytest.mark.django_db
def test_unrelated_student_cannot_list_messages():
    report = ReportFactory()
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_reporter_can_list_their_own_report_messages():
    student = UserFactory(role='student')
    report = ReportFactory(is_anonymous=False)
    IdentityService.create_identity(report, student)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_assigned_officer_can_list_messages():
    security = SecurityFactory()
    report = ReportFactory(assigned_to=security)

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_create_message_requires_authentication():
    report = ReportFactory()
    client = APIClient()
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'hi'})
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_tier_can_create_message():
    report = ReportFactory()
    security = SecurityFactory()

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'on my way'})

    assert response.status_code == 201
    assert response.data['content'] == 'on my way'
    assert response.data['sender_username'] == security.username
    assert Message.objects.filter(report=report, sender=security).exists()


@pytest.mark.django_db
def test_unrelated_student_cannot_create_message():
    report = ReportFactory()
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'hi'})

    assert response.status_code == 403
    assert not Message.objects.filter(report=report).exists()


@pytest.mark.django_db
def test_create_message_rejects_content_over_max_length():
    report = ReportFactory()
    security = SecurityFactory()

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post(
        f'/api/v1/reports/{report.id}/messages/create/', {'content': 'x' * 2001},
    )

    assert response.status_code == 400
