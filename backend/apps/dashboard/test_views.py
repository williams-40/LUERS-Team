import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory


@pytest.mark.django_db
def test_trends_requires_security_or_ict_admin():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get('/api/v1/dashboard/trends/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_trends_returns_daily_counts():
    # Phase 14: trends are scoped via get_accessible_reports — a plain
    # security account with no department affiliation sees nothing, so
    # this needs a real department head to see the two reports.
    security = SecurityFactory()
    department = DepartmentFactory(head=security)
    ReportFactory(department=department)
    ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/dashboard/trends/', {'days': 7})
    assert response.status_code == 200
    daily_counts = response.data['daily_counts']
    assert len(daily_counts) == 7
    assert sum(d['count'] for d in daily_counts) == 2


@pytest.mark.django_db
def test_trends_scoped_to_system_admin_sees_all():
    system_admin = SystemAdminFactory()
    ReportFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/dashboard/trends/', {'days': 7})
    assert response.status_code == 200
    assert sum(d['count'] for d in response.data['daily_counts']) == 2
