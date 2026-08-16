import pytest
from rest_framework.test import APIClient
from apps.accounts.models import Permission, Role
from apps.core.factories import ICTAdminFactory, SystemAdminFactory, StaffFactory


@pytest.mark.django_db
def test_manage_users_alone_cannot_assign_system_admin():
    """
    manage_users (e.g. ict_admin) is not sufficient to promote anyone to
    system_admin — only manage_roles is. This is the exact privilege-
    escalation gap the Phase 4 redesign closes.
    """
    admin = ICTAdminFactory()  # has manage_users, not manage_roles
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'system_admin'})

    assert response.status_code == 400
    target.refresh_from_db()
    assert target.role.slug == 'staff'


@pytest.mark.django_db
def test_manage_users_alone_cannot_assign_a_role_carrying_manage_roles():
    """Same guard, but for a hypothetical custom role that carries manage_roles rather than the system_admin slug itself."""
    manage_roles_perm = Permission.objects.get(slug='manage_roles')
    custom_role = Role.objects.create(slug='custom_super_role', label='Custom Super Role', is_builtin=False, is_active=True)
    custom_role.permissions.add(manage_roles_perm)

    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'custom_super_role'})

    assert response.status_code == 400
    target.refresh_from_db()
    assert target.role.slug == 'staff'


@pytest.mark.django_db
def test_manage_roles_holder_can_assign_system_admin():
    admin = SystemAdminFactory()  # has manage_roles
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'system_admin'})

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.role.slug == 'system_admin'


@pytest.mark.django_db
def test_manage_roles_holder_cannot_assign_system_admin_to_themselves():
    """Unconditional rule: no user may edit their own role field, regardless of what permission they hold."""
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{admin.id}/', {'role': 'responder'})

    assert response.status_code == 400
    admin.refresh_from_db()
    assert admin.role.slug == 'system_admin'


@pytest.mark.django_db
def test_ict_admin_can_still_assign_non_privileged_roles():
    """manage_users alone remains sufficient for ordinary role assignment — the guard is specifically about privilege escalation, not all role changes."""
    admin = ICTAdminFactory()
    target = StaffFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f'/api/v1/auth/users/{target.id}/', {'role': 'responder'})

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.role.slug == 'responder'


@pytest.mark.django_db
def test_new_user_can_be_created_as_system_admin_only_by_manage_roles_holder():
    admin = ICTAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post('/api/v1/auth/users/', {
        'username': 'sneaky_new_admin',
        'email': 'sneaky@example.com',
        'role': 'system_admin',
        'password': 'a-much-better-password-9!',
    })

    assert response.status_code == 400

    system_admin = SystemAdminFactory()
    client.force_authenticate(user=system_admin)
    response = client.post('/api/v1/auth/users/', {
        'username': 'legit_new_admin',
        'email': 'legit@example.com',
        'role': 'system_admin',
        'password': 'a-much-better-password-9!',
    })

    assert response.status_code == 201
