import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, DepartmentFactory, EmergencyCategoryFactory
from apps.reports.models import Report


@pytest.mark.django_db
def test_reporter_can_set_location_after_creation_without_one():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    EmergencyCategoryFactory(slug='security', department=security)

    client = APIClient()
    client.force_authenticate(user=student)
    create_response = client.post('/api/v1/reports/create/', {'urgency': 'panic', 'emergency_type': 'security'})
    assert create_response.status_code == 201
    report_id = create_response.data['id']
    assert Report.objects.get(id=report_id).latitude is None

    response = client.patch(f'/api/v1/reports/{report_id}/location/', {
        'latitude': '2.233300', 'longitude': '32.899900', 'location_accuracy': 15.0,
    })
    assert response.status_code == 200, response.data
    report = Report.objects.get(id=report_id)
    assert float(report.latitude) == pytest.approx(2.2333)
    assert float(report.longitude) == pytest.approx(32.8999)


@pytest.mark.django_db
def test_location_followup_rejects_overwriting_an_existing_location():
    student = UserFactory(role='student')
    department = DepartmentFactory(name='Library')

    client = APIClient()
    client.force_authenticate(user=student)
    create_response = client.post('/api/v1/reports/create/', {
        'urgency': 'normal', 'department': str(department.id), 'description': 'A normal report',
        'latitude': '1.000000', 'longitude': '1.000000',
    })
    report_id = create_response.data['id']

    response = client.patch(f'/api/v1/reports/{report_id}/location/', {
        'latitude': '2.000000', 'longitude': '2.000000',
    })
    assert response.status_code == 400


@pytest.mark.django_db
def test_location_followup_requires_reporter():
    student = UserFactory(role='student')
    other_student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    EmergencyCategoryFactory(slug='security', department=security)

    client = APIClient()
    client.force_authenticate(user=student)
    create_response = client.post('/api/v1/reports/create/', {'urgency': 'panic', 'emergency_type': 'security'})
    report_id = create_response.data['id']

    other_client = APIClient()
    other_client.force_authenticate(user=other_student)
    response = other_client.patch(f'/api/v1/reports/{report_id}/location/', {
        'latitude': '2.233300', 'longitude': '32.899900',
    })
    assert response.status_code == 404
