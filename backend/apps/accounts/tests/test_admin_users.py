import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from apps.core.factories import (
    UserFactory, SecurityFactory, ICTAdminFactory, ManagementFactory,
    StaffFactory, SystemAdminFactory,
)

ROLE_MATRIX = {
    'student': 403,
    'staff': 403,
    'security': 403,
    'management': 403,
    'ict_admin': 200,
    'system_admin': 200,
}


@pytest.mark.django_db
def test_list_users_role_matrix():
    client = APIClient()
    for role, expected in ROLE_MATRIX.items():
        user = UserFactory(role=role)
        client.force_authenticate(user=user)
        response = client.get('/api/v1/auth/users/')
        assert response.status_code == expected, f"role {role} got {response.status_code}"


@pytest.mark.django_db
def test_user_detail_role_matrix():
    target = UserFactory()
    client = APIClient()
    for role, expected in ROLE_MATRIX.items():
        user = UserFactory(role=role)
        client.force_authenticate(user=user)
        response = client.get(f'/api/v1/auth/users/{target.id}/')
        assert response.status_code == expected, f"role {role} got {response.status_code}"


@pytest.mark.django_db
def test_list_users_requires_authentication():
    client = APIClient()
    response = client.get('/api/v1/auth/users/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_can_create_user():
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/auth/users/', {
        'username': 'new_officer',
        'email': 'new_officer@example.com',
        'role': 'security',
        'password': 'a-much-better-password-9!',
    })

    assert response.status_code == 201
    assert response.data['username'] == 'new_officer'
    assert 'password' not in response.data

    login = APIClient().post('/api/v1/auth/login/', {
        'username': 'new_officer', 'password': 'a-much-better-password-9!',
    })
    assert login.status_code == 200


@pytest.mark.django_db
def test_create_user_rejects_weak_password():
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/auth/users/', {
        'username': 'weak_pw_user',
        'email': 'weak@example.com',
        'role': 'student',
        'password': '123',
    })

    assert response.status_code == 400
    assert 'password' in response.data


@pytest.mark.django_db
def test_admin_can_update_role_and_active_state():
    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'security'})

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.role == 'security'


@pytest.mark.django_db
def test_deactivating_a_user_blocks_their_login():
    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'is_active': False})
    assert response.status_code == 200

    login = APIClient().post('/api/v1/auth/login/', {
        'username': target.username, 'password': 'password123',
    })
    assert login.status_code == 401


@pytest.mark.django_db
def test_deactivating_a_user_blacklists_their_outstanding_tokens():
    admin = ICTAdminFactory()
    target = StaffFactory()
    refresh = RefreshToken.for_user(target)
    outstanding = OutstandingToken.objects.get(jti=refresh['jti'])

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'is_active': False})

    assert response.status_code == 200
    assert BlacklistedToken.objects.filter(token=outstanding).exists()


@pytest.mark.django_db
def test_reactivating_does_not_blacklist_tokens():
    admin = ICTAdminFactory()
    target = StaffFactory(is_active=False)
    refresh = RefreshToken.for_user(target)
    outstanding = OutstandingToken.objects.get(jti=refresh['jti'])

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'is_active': True})

    assert response.status_code == 200
    assert not BlacklistedToken.objects.filter(token=outstanding).exists()


@pytest.mark.django_db
def test_filter_users_by_role():
    SecurityFactory()
    SecurityFactory()
    StaffFactory()
    admin = ICTAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get('/api/v1/auth/users/', {'role': 'security'})

    assert response.status_code == 200
    assert all(u['role'] == 'security' for u in response.data['results'])
    assert len(response.data['results']) == 2


@pytest.mark.django_db
def test_filter_users_by_comma_separated_roles():
    SecurityFactory()
    ManagementFactory()
    StaffFactory()
    admin = ICTAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get('/api/v1/auth/users/', {'role': 'security,management'})

    assert response.status_code == 200
    roles = {u['role'] for u in response.data['results']}
    assert roles == {'security', 'management'}


@pytest.mark.django_db
def test_filter_users_by_search():
    UserFactory(username='findme_user', email='other@example.com')
    UserFactory(username='someone_else', email='findme@example.com')
    UserFactory(username='unrelated', email='unrelated@example.com')
    admin = ICTAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get('/api/v1/auth/users/', {'search': 'findme'})

    assert response.status_code == 200
    usernames = {u['username'] for u in response.data['results']}
    assert usernames == {'findme_user', 'someone_else'}


@pytest.mark.django_db
def test_filter_users_by_is_active():
    UserFactory(is_active=True)
    UserFactory(is_active=False)
    admin = ICTAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get('/api/v1/auth/users/', {'is_active': 'false'})

    assert response.status_code == 200
    assert all(u['is_active'] is False for u in response.data['results'])
