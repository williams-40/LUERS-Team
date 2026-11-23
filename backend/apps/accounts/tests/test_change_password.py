import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from apps.core.factories import UserFactory


@pytest.mark.django_db
def test_change_password_requires_authentication():
    client = APIClient()
    response = client.post('/api/v1/auth/change-password/', {
        'current_password': 'password123',
        'new_password': 'a-much-better-password-9!',
    })
    assert response.status_code == 401


@pytest.mark.django_db
def test_change_password_success_then_login_with_new_password():
    user = UserFactory()  # password123, from UserFactory
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post('/api/v1/auth/change-password/', {
        'current_password': 'password123',
        'new_password': 'a-much-better-password-9!',
    })
    assert response.status_code == 200

    anon_client = APIClient()
    old_login = anon_client.post('/api/v1/auth/login/', {
        'username': user.username, 'password': 'password123',
    })
    assert old_login.status_code == 401

    new_login = anon_client.post('/api/v1/auth/login/', {
        'username': user.username, 'password': 'a-much-better-password-9!',
    })
    assert new_login.status_code == 200


@pytest.mark.django_db
def test_change_password_rejects_wrong_current_password():
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post('/api/v1/auth/change-password/', {
        'current_password': 'totally-wrong',
        'new_password': 'a-much-better-password-9!',
    })

    assert response.status_code == 400
    assert 'current_password' in response.data


@pytest.mark.django_db
def test_change_password_rejects_weak_new_password():
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post('/api/v1/auth/change-password/', {
        'current_password': 'password123',
        'new_password': '123',
    })

    assert response.status_code == 400
    assert 'new_password' in response.data


@pytest.mark.django_db
def test_change_password_clears_must_change_password_flag():
    """
    Doubles as the forced first-login change for temp-password accounts
    (department heads/responders — AccountProvisioningService) — this is
    the one place that flag gets cleared.
    """
    user = UserFactory(must_change_password=True)
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post('/api/v1/auth/change-password/', {
        'current_password': 'password123',
        'new_password': 'a-much-better-password-9!',
    })

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.must_change_password is False

    me = client.get('/api/v1/auth/me/')
    assert me.data['must_change_password'] is False


@pytest.mark.django_db
def test_change_password_blacklists_outstanding_refresh_tokens():
    user = UserFactory()
    refresh = RefreshToken.for_user(user)
    outstanding = OutstandingToken.objects.get(jti=refresh['jti'])
    assert not BlacklistedToken.objects.filter(token=outstanding).exists()

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post('/api/v1/auth/change-password/', {
        'current_password': 'password123',
        'new_password': 'a-much-better-password-9!',
    })

    assert response.status_code == 200
    assert BlacklistedToken.objects.filter(token=outstanding).exists()
