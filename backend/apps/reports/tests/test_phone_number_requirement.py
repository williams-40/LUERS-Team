import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, DepartmentFactory


@pytest.mark.django_db
def test_report_creation_does_not_require_phone_number():
    """
    Phase 2: phone number is always optional on the report form — reporter
    identity now comes from the authenticated user (Report.reporter), not
    a per-report anonymity flag, so there's no longer a "non-anonymous
    reports need a contact number" rule.
    """
    student = UserFactory(role='student')
    department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'No phone number provided on purpose',
        'urgency': 'normal',
    })

    assert response.status_code == 201


@pytest.mark.django_db
def test_report_creation_with_phone_number_succeeds_and_updates_profile():
    student = UserFactory(role='student', phone_number=None)
    department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Has a phone number this time',
        'urgency': 'normal',
        'phone_number': '0712345678',
    })

    assert response.status_code == 201
    student.refresh_from_db()
    assert student.phone_number == '0712345678'


@pytest.mark.django_db
def test_submitted_phone_number_updates_existing_profile_value():
    student = UserFactory(role='student', phone_number='0700000001')
    department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Reporter gives an updated phone number',
        'urgency': 'normal',
        'phone_number': '0700000002',
    })

    assert response.status_code == 201
    student.refresh_from_db()
    assert student.phone_number == '0700000002'
