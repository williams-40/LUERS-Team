import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, ReportFactory, AnonymousReportFactory, DepartmentFactory
from apps.reports.services import IdentityService
from apps.audit.models import AuditLog
from apps.core.choices import Action


@pytest.mark.django_db
def test_non_anonymous_report_exposes_reporter_name_and_phone_to_authorized_viewer():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    reporter = UserFactory(role='student', first_name='Amina', last_name='Okello', phone_number='0700111222')
    report = ReportFactory(department=department, assigned_to=responder, is_anonymous=False)
    IdentityService.create_identity(report, reporter)

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.get(f'/api/v1/reports/{report.id}/')

    assert response.status_code == 200
    assert response.data['reporter_name'] == 'Amina Okello'
    assert response.data['reporter_phone'] == '0700111222'
    assert not AuditLog.objects.filter(report=report, action=Action.DEANONYMIZE).exists()


@pytest.mark.django_db
def test_anonymous_report_never_exposes_reporter_info():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    reporter = UserFactory(role='student', first_name='Amina', last_name='Okello', phone_number='0700111222')
    report = AnonymousReportFactory(department=department, assigned_to=responder)
    IdentityService.create_identity(report, reporter)

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.get(f'/api/v1/reports/{report.id}/')

    assert response.status_code == 200
    assert response.data['reporter_name'] is None
    assert response.data['reporter_phone'] is None


@pytest.mark.django_db
def test_reporter_name_falls_back_to_username_when_no_name_on_file():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    reporter = UserFactory(role='student', first_name='', last_name='', phone_number='0700111222')
    report = ReportFactory(department=department, assigned_to=responder, is_anonymous=False)
    IdentityService.create_identity(report, reporter)

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.get(f'/api/v1/reports/{report.id}/')

    assert response.data['reporter_name'] == reporter.username
