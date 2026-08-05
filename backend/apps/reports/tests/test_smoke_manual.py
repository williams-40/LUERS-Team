import io
import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, DepartmentFactory
from apps.core.choices import Status


@pytest.mark.django_db
def test_mine_evidence_and_dashboard_smoke():
    client = APIClient()

    security = SecurityFactory()
    department = DepartmentFactory(head=security)

    student = UserFactory(role='student')
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Smoke test report',
        'urgency': 'normal',
        'is_anonymous': False,
        'latitude': 2.2333,
        'longitude': 32.8999,
    })
    assert response.status_code == 201
    report_id = response.data['id']

    # Bug #1 check: /mine/ must actually return the student's own report now
    response = client.get('/api/v1/reports/mine/')
    assert response.status_code == 200
    ids = [r['id'] for r in response.data['results']]
    assert report_id in ids, f"mine/ did not return own report: {response.data}"

    # Bug #2 check: evidence upload by the actual reporter must not 500
    # (real JPEG magic bytes — Phase 6 added content-sniffing validation
    # that a plain "fake image bytes" placeholder no longer passes)
    fake_file = io.BytesIO(b'\xff\xd8\xff\xe0' + b'\x00' * 32)
    fake_file.name = "evidence.jpg"
    response = client.post(f'/api/v1/reports/{report_id}/evidence/', {
        'file': fake_file,
    }, format='multipart')
    assert response.status_code == 201, f"evidence upload failed: {response.status_code} {response.data}"

    # Resolve the report so dashboard average_response_time is exercised
    # (security is already this report's department head, from setup above)
    client.force_authenticate(user=security)
    response = client.post(f'/api/v1/reports/{report_id}/assign/', {'assigned_to': str(security.id)})
    assert response.status_code == 200
    response = client.patch(f'/api/v1/reports/{report_id}/status/', {'status': Status.RESOLVED})
    assert response.status_code == 200

    # Bug #3 check: dashboard summary must not 500 once a report is resolved
    response = client.get('/api/v1/dashboard/summary/')
    assert response.status_code == 200, f"dashboard summary failed: {response.status_code} {response.data}"
    assert response.data['average_response_time_hours'] is not None
    assert response.data['average_response_time_hours'] >= 0
