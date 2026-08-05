import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory


@pytest.mark.django_db
def test_get_me_requires_authentication():
    client = APIClient()
    response = client.get('/api/v1/auth/me/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_get_me_returns_own_profile():
    user = UserFactory(first_name='Ada', last_name='Lovelace')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get('/api/v1/auth/me/')

    assert response.status_code == 200
    assert response.data['username'] == user.username
    assert response.data['first_name'] == 'Ada'
    assert response.data['is_active'] is True


@pytest.mark.django_db
def test_patch_me_updates_editable_fields():
    user = UserFactory(first_name='Old', phone_number='+256700000000')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch('/api/v1/auth/me/', {
        'first_name': 'New',
        'last_name': 'Name',
        'phone_number': '+256700000001',
        'email': 'new-email@example.com',
    })

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.first_name == 'New'
    assert user.last_name == 'Name'
    assert user.phone_number == '+256700000001'
    assert user.email == 'new-email@example.com'


@pytest.mark.django_db
def test_patch_me_silently_ignores_role_university_id_and_username():
    user = UserFactory(role='student', university_id='STU-1')
    original_username = user.username
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch('/api/v1/auth/me/', {
        'role': 'system_admin',
        'university_id': 'HACKED',
        'username': 'someone_else',
        'first_name': 'Still Works',
    })

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.role.slug == 'student'
    assert user.university_id == 'STU-1'
    assert user.username == original_username
    assert user.first_name == 'Still Works'


@pytest.mark.django_db
def test_patch_me_rejects_duplicate_email_with_clean_400():
    UserFactory(email='taken@example.com')
    user = UserFactory(email='mine@example.com')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch('/api/v1/auth/me/', {'email': 'taken@example.com'})

    assert response.status_code == 400
    assert 'email' in response.data


@pytest.mark.django_db
def test_patch_me_allows_keeping_own_email_unchanged():
    user = UserFactory(email='mine@example.com')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch('/api/v1/auth/me/', {'email': 'mine@example.com', 'first_name': 'Touched'})

    assert response.status_code == 200


@pytest.mark.django_db
def test_patch_me_requires_authentication():
    client = APIClient()
    response = client.patch('/api/v1/auth/me/', {'first_name': 'X'})
    assert response.status_code == 401
