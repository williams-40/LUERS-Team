import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from apps.audit.models import AuditLog
from apps.core.choices import Action
from apps.core.factories import (
    UserFactory, ICTAdminFactory, ResponderFactory,
    StaffFactory, SystemAdminFactory,
)

ROLE_MATRIX = {
    'student': 403,
    'staff': 403,
    'responder': 403,
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
def test_manage_users_holder_can_list_and_view_users():
    """
    A manage_users holder (without a seeded role of their own — ict_admin
    was retired 2026-08-17) gets 200 on both endpoints. Uses ICTAdminFactory
    directly since ROLE_MATRIX above is keyed by raw role slugs and there's
    no longer a seeded role carrying just manage_users to put in it.
    """
    target = UserFactory()
    client = APIClient()
    client.force_authenticate(user=ICTAdminFactory())
    assert client.get('/api/v1/auth/users/').status_code == 200
    assert client.get(f'/api/v1/auth/users/{target.id}/').status_code == 200


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
        'role': 'responder',
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

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'responder'})

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.role.slug == 'responder'


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
    ResponderFactory()
    ResponderFactory()
    StaffFactory()
    admin = ICTAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get('/api/v1/auth/users/', {'role': 'responder'})

    assert response.status_code == 200
    assert all(u['role']['slug'] == 'responder' for u in response.data['results'])
    assert len(response.data['results']) == 2


@pytest.mark.django_db
def test_filter_users_by_comma_separated_roles():
    ResponderFactory()
    StaffFactory()
    UserFactory()  # default role: student — must not appear in the filtered results
    admin = ICTAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get('/api/v1/auth/users/', {'role': 'responder,staff'})

    assert response.status_code == 200
    roles = {u['role']['slug'] for u in response.data['results']}
    assert roles == {'responder', 'staff'}


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


@pytest.mark.django_db
def test_creating_a_user_creates_an_audit_log_entry():
    """
    Phase 8: closes a real blind spot — Phase 4's self-promotion guard
    exists to *prevent* privilege escalation, but until now a legitimate
    (or bypassed) account-admin action left zero audit trail.
    """
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/auth/users/', {
        'username': 'audited_new_user', 'email': 'audited_new_user@example.com',
        'role': 'responder', 'password': 'a-much-better-password-9!',
    })

    assert response.status_code == 201
    entry = AuditLog.objects.get(actor=admin, action=Action.ACCOUNT_CREATED)
    assert entry.after_state['username'] == 'audited_new_user'
    assert entry.after_state['role'] == 'responder'
    assert entry.report is None


@pytest.mark.django_db
def test_changing_a_users_role_creates_an_audit_log_entry():
    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'responder'})

    assert response.status_code == 200
    entry = AuditLog.objects.get(actor=admin, action=Action.ROLE_CHANGED)
    assert entry.before_state['role'] == 'staff'
    assert entry.after_state['role'] == 'responder'
    assert entry.after_state['user_id'] == str(target.id)


@pytest.mark.django_db
def test_deactivating_a_user_creates_an_audit_log_entry():
    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'is_active': False})

    assert response.status_code == 200
    entry = AuditLog.objects.get(actor=admin, action=Action.ACCOUNT_DEACTIVATED)
    assert entry.after_state['user_id'] == str(target.id)
    assert not AuditLog.objects.filter(actor=admin, action=Action.ACCOUNT_ACTIVATED).exists()


@pytest.mark.django_db
def test_reactivating_a_user_creates_an_audit_log_entry():
    admin = ICTAdminFactory()
    target = StaffFactory(is_active=False)
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'is_active': True})

    assert response.status_code == 200
    entry = AuditLog.objects.get(actor=admin, action=Action.ACCOUNT_ACTIVATED)
    assert entry.after_state['user_id'] == str(target.id)
    assert not AuditLog.objects.filter(actor=admin, action=Action.ACCOUNT_DEACTIVATED).exists()


@pytest.mark.django_db
def test_unrelated_field_update_creates_no_audit_entries():
    """A plain profile-field PATCH (no role/is_active change) shouldn't log anything — only real state changes are audit-worthy."""
    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'first_name': 'Renamed'})

    assert response.status_code == 200
    assert not AuditLog.objects.filter(actor=admin).exists()


@pytest.mark.django_db
def test_admin_cannot_deactivate_their_own_account():
    """
    Phase 8: unconditional guard mirroring the self-role-edit rule —
    without it, a system_admin could PATCH their own account inactive
    and immediately lock themselves out (SimpleJWT rechecks is_active on
    every request).
    """
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{admin.id}/', {'is_active': False})

    assert response.status_code == 400
    admin.refresh_from_db()
    assert admin.is_active is True
