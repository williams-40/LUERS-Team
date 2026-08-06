import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, DepartmentFactory


@pytest.mark.django_db
def test_non_anonymous_report_requires_phone_number():
    student = UserFactory(role='student')
    department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Missing phone number on purpose',
        'urgency': 'normal',
        'is_anonymous': False,
    })

    assert response.status_code == 400
    assert 'phone_number' in response.data


@pytest.mark.django_db
def test_non_anonymous_report_with_phone_number_succeeds_and_updates_profile():
    student = UserFactory(role='student', phone_number=None)
    department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Has a phone number this time',
        'urgency': 'normal',
        'is_anonymous': False,
        'phone_number': '0712345678',
    })

    assert response.status_code == 201
    student.refresh_from_db()
    assert student.phone_number == '0712345678'


@pytest.mark.django_db
def test_anonymous_report_does_not_require_phone_number():
    student = UserFactory(role='student')
    department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Anonymous report, no phone needed',
        'urgency': 'normal',
        'is_anonymous': True,
    })

    assert response.status_code == 201


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
        'is_anonymous': False,
        'phone_number': '0700000002',
    })

    assert response.status_code == 201
    student.refresh_from_db()
    assert student.phone_number == '0700000002'
