import pytest
from rest_framework.test import APIClient
from apps.reports.models import EmergencyCategory
from apps.core.factories import (
    UserFactory, ICTAdminFactory, SystemAdminFactory, DepartmentFactory, EmergencyCategoryFactory,
)

# Mirrors test_departments.py's ROLE_MATRIX: the category list is open to
# any authenticated user (the report form's picker needs it), unlike
# create/update/delete which are gated by manage_emergency_categories.
ROLE_MATRIX = {
    'student': 200,
    'responder': 200,
    'system_admin': 200,
}


@pytest.mark.django_db
def test_list_emergency_categories_role_matrix():
    client = APIClient()
    for role, expected in ROLE_MATRIX.items():
        user = UserFactory(role=role)
        client.force_authenticate(user=user)
        response = client.get('/api/v1/emergency-categories/')
        assert response.status_code == expected, f"role {role} got {response.status_code}"


@pytest.mark.django_db
def test_list_emergency_categories_requires_authentication():
    client = APIClient()
    response = client.get('/api/v1/emergency-categories/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_system_admin_can_create_emergency_category():
    admin = SystemAdminFactory()
    department = DepartmentFactory(name='Security')
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/emergency-categories/', {
        'name': 'Flood',
        'slug': 'flood',
        'description': 'Flooding on campus grounds',
        'department': str(department.id),
        'requires_description_and_routing': False,
        'is_active': True,
        'sort_order': 5,
    })

    assert response.status_code == 201, response.data
    assert EmergencyCategory.objects.filter(slug='flood', department=department).exists()


@pytest.mark.django_db
def test_student_cannot_create_emergency_category():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)

    response = client.post('/api/v1/emergency-categories/', {'name': 'Flood', 'slug': 'flood'})

    assert response.status_code == 403
    assert not EmergencyCategory.objects.filter(slug='flood').exists()


@pytest.mark.django_db
def test_ict_admin_equivalent_cannot_create_emergency_category():
    """
    manage_departments (which ICTAdminFactory holds) is deliberately not
    manage_emergency_categories — this is its own permission, granted only
    to system_admin, same convention as every other admin-managed entity.
    """
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/emergency-categories/', {'name': 'Flood', 'slug': 'flood'})

    assert response.status_code == 403
    assert not EmergencyCategory.objects.filter(slug='flood').exists()


@pytest.mark.django_db
def test_create_rejects_duplicate_slug():
    EmergencyCategoryFactory(slug='security')
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/emergency-categories/', {'name': 'Security Again', 'slug': 'security'})

    assert response.status_code == 400
    assert 'slug' in response.data


@pytest.mark.django_db
def test_create_rejects_invalid_slug_characters():
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/emergency-categories/', {'name': 'Bad Slug', 'slug': 'Bad Slug!'})

    assert response.status_code == 400
    assert 'slug' in response.data


@pytest.mark.django_db
def test_system_admin_can_update_emergency_category():
    category = EmergencyCategoryFactory(is_active=True)
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/emergency-categories/{category.id}/', {'is_active': False})

    assert response.status_code == 200
    category.refresh_from_db()
    assert category.is_active is False


@pytest.mark.django_db
def test_student_cannot_update_emergency_category():
    category = EmergencyCategoryFactory(is_active=True)
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)

    response = client.patch(f'/api/v1/emergency-categories/{category.id}/', {'is_active': False})

    assert response.status_code == 403
    category.refresh_from_db()
    assert category.is_active is True


@pytest.mark.django_db
def test_system_admin_can_delete_emergency_category():
    category = EmergencyCategoryFactory()
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.delete(f'/api/v1/emergency-categories/{category.id}/')

    assert response.status_code == 204
    assert not EmergencyCategory.objects.filter(id=category.id).exists()


@pytest.mark.django_db
def test_emergency_category_list_supports_is_active_filter():
    EmergencyCategoryFactory(is_active=True)
    EmergencyCategoryFactory(is_active=False)
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get('/api/v1/emergency-categories/', {'is_active': 'false'})

    assert response.status_code == 200
    assert all(c['is_active'] is False for c in response.data['results'])


@pytest.mark.django_db
def test_emergency_category_list_is_paginated():
    for _ in range(3):
        EmergencyCategoryFactory()
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get('/api/v1/emergency-categories/')

    assert response.status_code == 200
    assert 'results' in response.data
    assert 'count' in response.data


@pytest.mark.django_db
def test_emergency_category_read_shape_includes_department_name():
    department = DepartmentFactory(name='Security')
    category = EmergencyCategoryFactory(department=department)
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get(f'/api/v1/emergency-categories/{category.id}/')

    assert response.status_code == 200
    assert response.data['department_name'] == 'Security'
