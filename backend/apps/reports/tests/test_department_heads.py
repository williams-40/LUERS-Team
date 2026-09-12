import pytest
from django.core import mail
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from apps.audit.models import AuditLog
from apps.core.choices import Action
from apps.core.factories import SecurityFactory, SystemAdminFactory, ICTAdminFactory, DepartmentFactory

User = get_user_model()


@pytest.mark.django_db
def test_system_admin_can_create_head_and_assign_department():
    admin = SystemAdminFactory()
    department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f'/api/v1/departments/{department.id}/heads/', {
        'username': 'new_head', 'email': 'new_head@example.com',
        'first_name': 'New', 'last_name': 'Head',
    })

    assert response.status_code == 201
    new_user = User.objects.get(username='new_head')
    assert new_user.role.slug == 'department_head'
    assert new_user.has_usable_password() is True
    assert new_user.must_change_password is True
    department.refresh_from_db()
    assert department.head_id == new_user.id
    assert new_user in department.members.all()
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "Your LUERS account has been created"
    assert '/login' in mail.outbox[0].body
    entry = AuditLog.objects.get(actor=admin, action=Action.HEAD_CREATED)
    assert entry.after_state['username'] == 'new_head'
    assert entry.after_state['department_id'] == str(department.id)


@pytest.mark.django_db
def test_manage_departments_holder_without_system_admin_role_can_also_create_head():
    admin = ICTAdminFactory()
    department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f'/api/v1/departments/{department.id}/heads/', {
        'username': 'new_head', 'email': 'new_head@example.com',
    })

    assert response.status_code == 201


@pytest.mark.django_db
def test_department_head_cannot_create_another_head():
    """
    Headship (or plain responder-hood) alone isn't manage_departments —
    only system_admin's role (or another manage_departments holder) can
    reach this endpoint.
    """
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    client = APIClient()
    client.force_authenticate(user=head)

    response = client.post(f'/api/v1/departments/{department.id}/heads/', {
        'username': 'nope', 'email': 'nope@example.com',
    })

    assert response.status_code == 403
    assert not User.objects.filter(username='nope').exists()


@pytest.mark.django_db
def test_head_creation_reassigns_an_existing_head():
    admin = SystemAdminFactory()
    old_head = SecurityFactory()
    department = DepartmentFactory(head=old_head)
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f'/api/v1/departments/{department.id}/heads/', {
        'username': 'replacement_head', 'email': 'replacement_head@example.com',
    })

    assert response.status_code == 201
    department.refresh_from_db()
    new_head = User.objects.get(username='replacement_head')
    assert department.head_id == new_head.id
    assert department.head_id != old_head.id
    # the old head's account itself is untouched, just no longer this department's head
    old_head.refresh_from_db()
    assert old_head.is_active is True


@pytest.mark.django_db
def test_head_creation_ignores_role_and_department_fields_in_payload():
    admin = SystemAdminFactory()
    department = DepartmentFactory()
    other_department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f'/api/v1/departments/{department.id}/heads/', {
        'username': 'tamper_attempt', 'email': 'tamper@example.com',
        'role': 'system_admin', 'department': str(other_department.id),
    })

    assert response.status_code == 201
    new_user = User.objects.get(username='tamper_attempt')
    assert new_user.role.slug == 'department_head'
    department.refresh_from_db()
    other_department.refresh_from_db()
    assert department.head_id == new_user.id
    assert other_department.head_id != new_user.id


@pytest.mark.django_db
def test_inactive_department_returns_404():
    admin = SystemAdminFactory()
    department = DepartmentFactory(is_active=False)
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f'/api/v1/departments/{department.id}/heads/', {
        'username': 'nope', 'email': 'nope@example.com',
    })

    assert response.status_code == 404


@override_settings(RATELIMIT_ENABLE=True)
@pytest.mark.django_db
def test_head_creation_is_rate_limited():
    admin = SystemAdminFactory()
    department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    responses = [
        client.post(f'/api/v1/departments/{department.id}/heads/', {
            'username': f'ratelimit_test_{i}', 'email': f'ratelimit_test_{i}@example.com',
        })
        for i in range(11)
    ]

    assert [r.status_code for r in responses[:10]] == [201] * 10
    assert responses[10].status_code == 403
