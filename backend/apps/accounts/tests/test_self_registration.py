import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory


def _payload(**overrides):
    payload = {
        'username': 'newstudent',
        'email': 'newstudent@example.com',
        'first_name': 'New',
        'last_name': 'Student',
        'phone_number': '+256700000000',
        'university_id': 'S12345',
        'password': 'StrongPass456',
        'role': 'student',
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_register_student_succeeds_and_can_log_in():
    client = APIClient()
    resp = client.post('/api/v1/auth/register/', _payload())
    assert resp.status_code == 201
    assert resp.data['role']['slug'] == 'student'
    assert resp.data['is_active'] is True
    assert 'password' not in resp.data

    login = client.post('/api/v1/auth/login/', {'username': 'newstudent', 'password': 'StrongPass456'})
    assert login.status_code == 200


@pytest.mark.django_db
def test_register_staff_succeeds():
    client = APIClient()
    resp = client.post('/api/v1/auth/register/', _payload(
        username='newstaff', email='newstaff@example.com', role='staff',
    ))
    assert resp.status_code == 201
    assert resp.data['role']['slug'] == 'staff'


@pytest.mark.django_db
@pytest.mark.parametrize('role', ['system_admin', 'department_head', 'responder'])
def test_register_rejects_privileged_roles(role):
    client = APIClient()
    resp = client.post('/api/v1/auth/register/', _payload(role=role))
    assert resp.status_code == 400
    assert 'role' in resp.data


@pytest.mark.django_db
def test_register_rejects_duplicate_username():
    UserFactory(username='newstudent')
    client = APIClient()
    resp = client.post('/api/v1/auth/register/', _payload(email='different@example.com'))
    assert resp.status_code == 400
    assert 'username' in resp.data


@pytest.mark.django_db
def test_register_rejects_duplicate_email():
    UserFactory(email='newstudent@example.com')
    client = APIClient()
    resp = client.post('/api/v1/auth/register/', _payload(username='different'))
    assert resp.status_code == 400
    assert 'email' in resp.data


@pytest.mark.django_db
def test_register_rejects_weak_password():
    client = APIClient()
    resp = client.post('/api/v1/auth/register/', _payload(password='123'))
    assert resp.status_code == 400
    assert 'password' in resp.data
