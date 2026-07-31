import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ReportFactory


@pytest.mark.django_db
def test_reports_export_requires_admin_tier():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get('/api/v1/reports/export/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_reports_export_csv():
    security = SecurityFactory()
    ReportFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/reports/export/', {'export_format': 'csv'})
    assert response.status_code == 200
    assert response['Content-Type'] == 'text/csv'
    body = b''.join(response.streaming_content) if response.streaming else response.content
    assert body.count(b'\n') >= 2


@pytest.mark.django_db
def test_reports_export_respects_status_filter():
    from apps.core.choices import Status
    security = SecurityFactory()
    ReportFactory(status=Status.NEW)
    ReportFactory(status=Status.RESOLVED)

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/reports/export/', {'export_format': 'csv', 'status': Status.RESOLVED})
    assert response.status_code == 200
    body = b''.join(response.streaming_content) if response.streaming else response.content
    rows = [r for r in body.decode().splitlines() if r]
    assert len(rows) == 2  # header + 1 resolved report
