import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory
from apps.reports.models import Report
from apps.core.choices import Status

@pytest.mark.django_db
def test_full_lifecycle():
    client = APIClient()

    # 1. Create a student and login
    student = UserFactory(role='student')
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'category': 'theft',
        'description': 'Integration test',
        'urgency': 'normal',
        'is_anonymous': False,
        'latitude': 2.2333,
        'longitude': 32.8999,
    })
    assert response.status_code == 201
    report_id = response.data['id']

    # 2. Login as security and assign
    security = SecurityFactory()
    client.force_authenticate(user=security)
    response = client.post(f'/api/v1/reports/{report_id}/assign/', {
        'assigned_to': str(security.id)
    })
    assert response.status_code == 200

    # 3. Update status
    response = client.patch(f'/api/v1/reports/{report_id}/status/', {
        'status': Status.IN_PROGRESS
    })
    assert response.status_code == 200

    # 4. Verify audit logs
    report = Report.objects.get(id=report_id)
    assert report.audit_logs.count() >= 3  # create, assign, status_update