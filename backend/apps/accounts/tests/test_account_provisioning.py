import pytest
from django.core import mail
from apps.accounts.models import Role
from apps.accounts.services import AccountProvisioningService


@pytest.mark.django_db
def test_create_account_gives_a_real_usable_temp_password():
    responder_role = Role.objects.get(slug='responder')
    user = AccountProvisioningService.create_account(
        role=responder_role, username='new_head', email='new_head@example.com',
    )

    assert user.has_usable_password() is True
    assert user.must_change_password is True
    assert user.role.slug == 'responder'


@pytest.mark.django_db
def test_create_account_sends_invite_email_with_login_link_and_temp_password():
    responder_role = Role.objects.get(slug='responder')
    AccountProvisioningService.create_account(
        role=responder_role, username='new_head', email='new_head@example.com',
    )

    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ['new_head@example.com']
    assert sent.subject == "Your LUERS account has been created"
    assert '/login' in sent.body
    assert 'reset-password' not in sent.body
    assert 'Username: new_head' in sent.body
    assert 'Temporary password: ' in sent.body


@pytest.mark.django_db
def test_temp_password_actually_logs_in():
    from rest_framework.test import APIClient
    responder_role = Role.objects.get(slug='responder')
    AccountProvisioningService.create_account(
        role=responder_role, username='new_head', email='new_head@example.com',
    )
    temp_password = mail.outbox[0].body.split('Temporary password: ')[1].split('\n')[0]

    client = APIClient()
    response = client.post('/api/v1/auth/login/', {'username': 'new_head', 'password': temp_password})
    assert response.status_code == 200
