import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.test import override_settings
from apps.core.services import EncryptionService
from apps.core.factories import UserFactory, ReportFactory
from apps.reports.services import IdentityService
from apps.reports.models import ReportIdentity

KEY_A = Fernet.generate_key().decode()
KEY_B = Fernet.generate_key().decode()


def test_encrypt_uses_the_first_key_in_fernet_keys():
    with override_settings(FERNET_KEYS=[KEY_B, KEY_A]):
        ciphertext = EncryptionService.encrypt('hello')

    # Only KEY_B (the first/newest key) should be able to decrypt it.
    assert Fernet(KEY_B.encode()).decrypt(ciphertext.encode()).decode() == 'hello'
    with pytest.raises(Exception):
        Fernet(KEY_A.encode()).decrypt(ciphertext.encode())


def test_decrypt_falls_back_to_an_older_key_still_listed():
    with override_settings(FERNET_KEYS=[KEY_A]):
        ciphertext = EncryptionService.encrypt('hello')

    # KEY_B was prepended as the new "current" key, but KEY_A is still
    # listed — old ciphertext must remain readable.
    with override_settings(FERNET_KEYS=[KEY_B, KEY_A]):
        assert EncryptionService.decrypt(ciphertext) == 'hello'


def test_decrypt_returns_none_once_the_old_key_is_fully_retired():
    with override_settings(FERNET_KEYS=[KEY_A]):
        ciphertext = EncryptionService.encrypt('hello')

    with override_settings(FERNET_KEYS=[KEY_B]):
        assert EncryptionService.decrypt(ciphertext) is None


@pytest.mark.django_db
def test_rotate_fernet_key_command_re_encrypts_existing_identities():
    with override_settings(FERNET_KEYS=[KEY_A]):
        student = UserFactory(role='student')
        report = ReportFactory()
        identity = IdentityService.create_identity(report, student)
        original_hash = identity.reporter_hash

        call_command('rotate_fernet_key', '--new-key', KEY_B)

    identity.refresh_from_db()

    # Old key alone can no longer decrypt the (now re-encrypted) row.
    with override_settings(FERNET_KEYS=[KEY_A]):
        assert EncryptionService.decrypt(identity.encrypted_reporter_ref) is None

    # New key alone can, and the underlying reporter is unchanged.
    with override_settings(FERNET_KEYS=[KEY_B]):
        reporter_id = IdentityService.get_reporter(identity)
        assert reporter_id == str(student.id)
        # reporter_hash is untouched by rotation (see docs) — ownership
        # lookups keep working without any migration.
        assert identity.reporter_hash == original_hash
        assert IdentityService.is_owner(identity, student)


@pytest.mark.django_db
def test_rotate_fernet_key_command_generates_a_key_when_none_given(capsys):
    with override_settings(FERNET_KEYS=[KEY_A]):
        student = UserFactory(role='student')
        report = ReportFactory()
        IdentityService.create_identity(report, student)

        call_command('rotate_fernet_key')

    captured = capsys.readouterr()
    assert 'Re-encrypted 1 ReportIdentity row(s)' in captured.out
    assert 'generated one' in captured.out.lower()


@pytest.mark.django_db
def test_rotate_fernet_key_reports_undecryptable_rows_without_crashing():
    with override_settings(FERNET_KEYS=[KEY_A]):
        student = UserFactory(role='student')
        report = ReportFactory()
        identity = IdentityService.create_identity(report, student)

    # Simulate a row encrypted under a key that's no longer in FERNET_KEYS
    # at all (not even as an old fallback) — the command must flag it, not
    # silently drop it or crash the whole run.
    with override_settings(FERNET_KEYS=[KEY_B]):
        call_command('rotate_fernet_key', '--new-key', Fernet.generate_key().decode())

    identity.refresh_from_db()
    # Left untouched since it couldn't be decrypted under any current key.
    with override_settings(FERNET_KEYS=[KEY_A]):
        assert EncryptionService.decrypt(identity.encrypted_reporter_ref) is not None
