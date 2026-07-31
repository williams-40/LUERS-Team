import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ManagementFactory, ReportFactory
from apps.reports.services import IdentityService
from apps.audit.models import AuditLog
from apps.core.choices import Action


@pytest.mark.django_db
def test_reveal_identity_decrypts_reporter():
    reporter = UserFactory()
    report = ReportFactory()
    IdentityService.create_identity(report, reporter)

    management = ManagementFactory()
    client = APIClient()
    client.force_authenticate(user=management)
    response = client.post(f'/api/v1/reports/{report.id}/reveal/')

    assert response.status_code == 200
    assert response.data['reporter_id'] == str(reporter.id)
    assert response.data['username'] == reporter.username
    assert AuditLog.objects.filter(report=report, action=Action.DEANONYMIZE, actor=management).exists()


@pytest.mark.django_db
def test_reveal_identity_forbidden_for_non_management():
    reporter = UserFactory()
    report = ReportFactory()
    IdentityService.create_identity(report, reporter)

    security = SecurityFactory()
    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post(f'/api/v1/reports/{report.id}/reveal/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_reveal_identity_404_when_no_identity_record():
    report = ReportFactory()
    management = ManagementFactory()
    client = APIClient()
    client.force_authenticate(user=management)
    response = client.post(f'/api/v1/reports/{report.id}/reveal/')
    assert response.status_code == 404
