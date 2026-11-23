import pytest
from django.core import mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from apps.core.factories import UserFactory


@pytest.mark.django_db
def test_password_reset_request_sends_email():
    user = UserFactory(email='resettest@example.com')
    client = APIClient()
    resp = client.post('/api/v1/auth/password-reset/', {'email': user.email})
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert 'reset-password' in mail.outbox[0].body


@pytest.mark.django_db
def test_password_reset_request_silent_for_unknown_email():
    client = APIClient()
    resp = client.post('/api/v1/auth/password-reset/', {'email': 'doesnotexist@example.com'})
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_password_reset_confirm_roundtrip():
    user = UserFactory()
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    client = APIClient()
    resp = client.post('/api/v1/auth/password-reset/confirm/', {
        'uid': uid, 'token': token, 'new_password': 'NewStrongPass456',
    })
    assert resp.status_code == 200

    resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'password123'})
    assert resp.status_code == 401
    resp = client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'NewStrongPass456'})
    assert resp.status_code == 200


@pytest.mark.django_db
def test_password_reset_confirm_rejects_invalid_token():
    user = UserFactory()
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    client = APIClient()
    resp = client.post('/api/v1/auth/password-reset/confirm/', {
        'uid': uid, 'token': 'bogus-token', 'new_password': 'NewStrongPass456',
    })
    assert resp.status_code == 400


@pytest.mark.django_db
def test_password_reset_confirm_rejects_weak_password():
    user = UserFactory()
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    client = APIClient()
    resp = client.post('/api/v1/auth/password-reset/confirm/', {
        'uid': uid, 'token': token, 'new_password': '123',
    })
    assert resp.status_code == 400
