import pytest
from django.core import mail
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, DepartmentFactory

User = get_user_model()


@pytest.mark.django_db
def test_department_head_can_create_responder_in_own_department():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    client = APIClient()
    client.force_authenticate(user=head)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'new_responder', 'email': 'new_responder@example.com',
        'first_name': 'New', 'last_name': 'Responder',
    })

    assert response.status_code == 201
    new_user = User.objects.get(username='new_responder')
    assert new_user.role.slug == 'responder'
    assert new_user.has_usable_password() is True
    assert new_user.must_change_password is True
    assert new_user in department.members.all()
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "Your LUERS account has been created"
    assert '/login' in mail.outbox[0].body
    assert 'reset-password' not in mail.outbox[0].body


@pytest.mark.django_db
def test_non_head_department_member_cannot_create_responder():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    client = APIClient()
    client.force_authenticate(user=member)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'nope', 'email': 'nope@example.com',
    })

    assert response.status_code == 403
    assert not User.objects.filter(username='nope').exists()


@pytest.mark.django_db
def test_head_of_other_department_cannot_create_responder_here():
    head_a = SecurityFactory()
    DepartmentFactory(head=head_a)
    department_b = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=head_a)

    response = client.post(f'/api/v1/departments/{department_b.id}/responders/', {
        'username': 'nope', 'email': 'nope@example.com',
    })

    assert response.status_code == 403
    assert not User.objects.filter(username='nope').exists()


@pytest.mark.django_db
def test_system_admin_is_deliberately_blocked_from_this_endpoint():
    """
    Design choice (Phase 6, per the Phase 0.5 addendum's D.1): system_admin
    already has a fully general provisioning path elsewhere, so this
    endpoint stays exclusively department-head-scoped — confirming
    system_admin is blocked here proves that's a deliberate boundary, not
    an oversight.
    """
    admin = SystemAdminFactory()
    department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'nope', 'email': 'nope@example.com',
    })

    assert response.status_code == 403


@pytest.mark.django_db
def test_responder_creation_ignores_role_and_department_fields_in_payload():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    other_department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=head)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'tamper_attempt', 'email': 'tamper@example.com',
        'role': 'system_admin', 'department': str(other_department.id),
    })

    assert response.status_code == 201
    new_user = User.objects.get(username='tamper_attempt')
    assert new_user.role.slug == 'responder'
    assert new_user in department.members.all()
    assert new_user not in other_department.members.all()


@pytest.mark.django_db
def test_inactive_department_returns_404():
    head = SecurityFactory()
    department = DepartmentFactory(head=head, is_active=False)
    client = APIClient()
    client.force_authenticate(user=head)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'nope', 'email': 'nope@example.com',
    })

    assert response.status_code == 404


@pytest.mark.django_db
def test_duplicate_username_rejected():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    UserFactory(username='dupeuser')
    client = APIClient()
    client.force_authenticate(user=head)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'dupeuser', 'email': 'unique@example.com',
    })

    assert response.status_code == 400
    assert 'username' in response.data


@pytest.mark.django_db
def test_duplicate_email_rejected():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    UserFactory(email='taken@example.com')
    client = APIClient()
    client.force_authenticate(user=head)

    response = client.post(f'/api/v1/departments/{department.id}/responders/', {
        'username': 'uniqueuser', 'email': 'taken@example.com',
    })

    assert response.status_code == 400
    assert 'email' in response.data


@override_settings(RATELIMIT_ENABLE=True)
@pytest.mark.django_db
def test_responder_creation_is_rate_limited():
    """
    Phase 8: this is a real account-creation surface reachable by any
    department head — flagged as a gap in the Phase 6 design doc (D.9)
    but not closed until now. Rate limiting is deliberately disabled
    under DEBUG (this codebase's dev-server convention, see
    settings/base.py), so it's verified here via override_settings
    rather than a live dev-server request.
    """
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    client = APIClient()
    client.force_authenticate(user=head)

    responses = [
        client.post(f'/api/v1/departments/{department.id}/responders/', {
            'username': f'ratelimit_test_{i}', 'email': f'ratelimit_test_{i}@example.com',
        })
        for i in range(11)
    ]

    assert [r.status_code for r in responses[:10]] == [201] * 10
    # django_ratelimit's Ratelimited exception subclasses Django's
    # PermissionDenied, which DRF's default exception handler maps to
    # 403 — not 429 — confirmed here since this codebase has no prior
    # rate-limit test establishing that mapping.
    assert responses[10].status_code == 403
