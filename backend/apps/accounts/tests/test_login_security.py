import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory


@pytest.mark.django_db
def test_login_lockout_after_repeated_failures():
    user = UserFactory(username='lockouttest1')
    client = APIClient()

    for _ in range(5):
        resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrongpass'})
        assert resp.status_code == 401

    # 6th attempt is locked out even with the correct password
    resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'password123'})
    assert resp.status_code == 429


@pytest.mark.django_db
def test_login_lockout_resets_on_success():
    user = UserFactory(username='lockouttest2')
    client = APIClient()

    for _ in range(4):
        resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrongpass'})
        assert resp.status_code == 401

    resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'password123'})
    assert resp.status_code == 200

    # counter reset by the successful login — not locked out yet
    resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrongpass'})
    assert resp.status_code == 401


@pytest.mark.django_db
def test_login_lockout_is_per_username():
    user_a = UserFactory(username='lockouttest3a')
    user_b = UserFactory(username='lockouttest3b')
    client = APIClient()

    for _ in range(5):
        client.post('/api/v1/auth/login/', {'username': user_a.username, 'password': 'wrongpass'})

    resp = client.post('/api/v1/auth/login/', {'username': user_b.username, 'password': 'password123'})
    assert resp.status_code == 200
