import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ICTAdminFactory, ReportFactory
from apps.reports.services import ReportService
from apps.core.choices import Status, Action


@pytest.mark.django_db
def test_audit_list_requires_admin_tier():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get('/api/v1/audit/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_audit_list_visible_to_admin_tier():
    security = SecurityFactory()
    report = ReportFactory()
    ReportService.update_status(report, Status.ACKNOWLEDGED, security, ip_address='127.0.0.1')

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/audit/')
    assert response.status_code == 200
    actions = [entry['action'] for entry in response.data['results']]
    assert Action.STATUS_UPDATE in actions
    entry = next(e for e in response.data['results'] if e['action'] == Action.STATUS_UPDATE)
    assert str(entry['actor']) == str(security.id)


@pytest.mark.django_db
def test_audit_list_filters_by_action():
    security = SecurityFactory()
    report = ReportFactory()
    ReportService.update_status(report, Status.ACKNOWLEDGED, security, ip_address='127.0.0.1')

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/audit/', {'action': Action.CREATE})
    assert response.status_code == 200
    assert all(e['action'] == Action.CREATE for e in response.data['results'])


@pytest.mark.django_db
def test_audit_export_csv():
    ict_admin = ICTAdminFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=ict_admin)
    response = client.get('/api/v1/audit/export/', {'export_format': 'csv'})
    assert response.status_code == 200
    assert response['Content-Type'] == 'text/csv'


@pytest.mark.django_db
def test_audit_export_pdf():
    ict_admin = ICTAdminFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=ict_admin)
    response = client.get('/api/v1/audit/export/', {'export_format': 'pdf'})
    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
