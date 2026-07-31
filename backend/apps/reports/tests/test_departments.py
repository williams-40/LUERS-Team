import pytest
from rest_framework.test import APIClient
from apps.reports.models import Department
from apps.core.factories import (
    UserFactory, SecurityFactory, ManagementFactory, ICTAdminFactory,
    SystemAdminFactory, ReportFactory, DepartmentFactory,
)

ROLE_MATRIX = {
    'student': 403,
    'security': 403,
    'management': 403,
    'ict_admin': 200,
    'system_admin': 200,
}


@pytest.mark.django_db
def test_list_departments_role_matrix():
    client = APIClient()
    for role, expected in ROLE_MATRIX.items():
        user = UserFactory(role=role)
        client.force_authenticate(user=user)
        response = client.get('/api/v1/departments/')
        assert response.status_code == expected, f"role {role} got {response.status_code}"


@pytest.mark.django_db
def test_list_departments_requires_authentication():
    client = APIClient()
    response = client.get('/api/v1/departments/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_can_create_department_with_valid_head():
    admin = ICTAdminFactory()
    head = SecurityFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/departments/', {
        'name': 'Test Security Dept',
        'description': 'Handles things',
        'head': str(head.id),
        'members': [],
        'is_active': True,
    })

    assert response.status_code == 201
    assert Department.objects.filter(name='Test Security Dept', head=head).exists()


@pytest.mark.django_db
def test_create_department_rejects_non_admin_tier_head():
    admin = SystemAdminFactory()
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/departments/', {
        'name': 'Bad Head Dept',
        'description': '',
        'head': str(student.id),
        'members': [],
        'is_active': True,
    })

    assert response.status_code == 400
    assert 'head' in response.data


@pytest.mark.django_db
def test_create_department_rejects_non_admin_tier_members():
    admin = ICTAdminFactory()
    staff = UserFactory(role='staff')
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/departments/', {
        'name': 'Bad Members Dept',
        'description': '',
        'members': [str(staff.id)],
        'is_active': True,
    })

    assert response.status_code == 400
    assert 'members' in response.data


@pytest.mark.django_db
def test_create_department_accepts_admin_tier_members():
    admin = ICTAdminFactory()
    officer = SecurityFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/departments/', {
        'name': 'Good Members Dept',
        'description': '',
        'members': [str(officer.id)],
        'is_active': True,
    })

    assert response.status_code == 201
    dept = Department.objects.get(name='Good Members Dept')
    assert officer in dept.members.all()


@pytest.mark.django_db
def test_create_department_rejects_duplicate_name():
    DepartmentFactory(name='Existing Dept')
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/departments/', {
        'name': 'Existing Dept',
        'description': '',
        'is_active': True,
    })

    assert response.status_code == 400
    assert 'name' in response.data


@pytest.mark.django_db
def test_non_admin_cannot_create_department():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)

    response = client.post('/api/v1/departments/', {'name': 'Nope', 'is_active': True})

    assert response.status_code == 403
    assert not Department.objects.filter(name='Nope').exists()


@pytest.mark.django_db
def test_admin_can_update_department():
    dept = DepartmentFactory(is_active=True)
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/departments/{dept.id}/', {'is_active': False})

    assert response.status_code == 200
    dept.refresh_from_db()
    assert dept.is_active is False


@pytest.mark.django_db
def test_delete_department_nulls_out_report_department_rather_than_erroring():
    dept = DepartmentFactory()
    report = ReportFactory(department=dept)
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.delete(f'/api/v1/departments/{dept.id}/')

    assert response.status_code == 204
    report.refresh_from_db()
    assert report.department is None


@pytest.mark.django_db
def test_department_list_supports_is_active_filter():
    DepartmentFactory(is_active=True)
    DepartmentFactory(is_active=False)
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get('/api/v1/departments/', {'is_active': 'false'})

    assert response.status_code == 200
    assert all(d['is_active'] is False for d in response.data['results'])


@pytest.mark.django_db
def test_department_list_is_paginated():
    for i in range(3):
        DepartmentFactory()
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get('/api/v1/departments/')

    assert response.status_code == 200
    assert 'results' in response.data
    assert 'count' in response.data
