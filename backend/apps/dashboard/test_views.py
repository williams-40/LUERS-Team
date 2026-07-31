import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ReportFactory


@pytest.mark.django_db
def test_trends_requires_security_or_ict_admin():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get('/api/v1/dashboard/trends/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_trends_returns_daily_counts():
    security = SecurityFactory()
    ReportFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/dashboard/trends/', {'days': 7})
    assert response.status_code == 200
    daily_counts = response.data['daily_counts']
    assert len(daily_counts) == 7
    assert sum(d['count'] for d in daily_counts) == 2
