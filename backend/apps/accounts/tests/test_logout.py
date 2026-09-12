import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory


@pytest.mark.django_db
def test_logout_blacklists_refresh_token():
    user = UserFactory()
    client = APIClient()

    login_resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'password123'})
    assert login_resp.status_code == 200
    access = login_resp.data['access']
    refresh = login_resp.data['refresh']

    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    logout_resp = client.post('/api/v1/auth/logout/', {'refresh': refresh})
    assert logout_resp.status_code == 205

    client.credentials()
    refresh_resp = client.post('/api/v1/auth/refresh/', {'refresh': refresh})
    assert refresh_resp.status_code == 401


@pytest.mark.django_db
def test_logout_requires_refresh_token():
    user = UserFactory()
    client = APIClient()
    login_resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'password123'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_resp.data["access"]}')

    resp = client.post('/api/v1/auth/logout/', {})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_logout_requires_authentication():
    client = APIClient()
    resp = client.post('/api/v1/auth/logout/', {'refresh': 'whatever'})
    assert resp.status_code == 401
