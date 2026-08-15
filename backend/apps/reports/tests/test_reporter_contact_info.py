import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, ReportFactory, DepartmentFactory


@pytest.mark.django_db
def test_report_exposes_reporter_name_and_phone_to_authorized_viewer():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    reporter = UserFactory(role='student', first_name='Amina', last_name='Okello', phone_number='0700111222')
    report = ReportFactory(department=department, assigned_to=responder, reporter=reporter)

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.get(f'/api/v1/reports/{report.id}/')

    assert response.status_code == 200
    assert response.data['reporter_name'] == 'Amina Okello'
    assert response.data['reporter_phone'] == '0700111222'


@pytest.mark.django_db
def test_reporter_name_falls_back_to_username_when_no_name_on_file():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    reporter = UserFactory(role='student', first_name='', last_name='', phone_number='0700111222')
    report = ReportFactory(department=department, assigned_to=responder, reporter=reporter)

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.get(f'/api/v1/reports/{report.id}/')

    assert response.data['reporter_name'] == reporter.username
