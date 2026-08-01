from cryptography.fernet import Fernet
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from apps.reports.models import ReportIdentity
from apps.core.services import _fernet


class Command(BaseCommand):
    help = (
        'Rotates the Fernet key used to encrypt ReportIdentity.encrypted_reporter_ref: '
        're-encrypts every row under a new key so the old key(s) can eventually be '
        'retired from FERNET_KEYS. Does NOT touch IDENTITY_HASH_KEY/reporter_hash — '
        'see docs/identity-escrow-key-rotation.md for why. Run this BEFORE adding the '
        'new key as the first entry in FERNET_KEYS in deployment secrets.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--new-key',
            type=str,
            default=None,
            help='The new Fernet key to re-encrypt under. If omitted, a new key is generated and printed once.',
        )

    def handle(self, *args, **options):
        new_key = options['new_key']
        if not new_key:
            new_key = Fernet.generate_key().decode()
            self.stdout.write(self.style.WARNING(
                f'No --new-key given — generated one. SAVE THIS, it is only shown once:\n  {new_key}'
            ))

        try:
            new_fernet = Fernet(new_key.encode() if isinstance(new_key, str) else new_key)
        except Exception as exc:
            raise CommandError(f'--new-key is not a valid Fernet key: {exc}')

        # MultiFernet over the CURRENT settings.FERNET_KEYS — can decrypt
        # anything encrypted under any key still listed there, which is
        # every row that hasn't already been migrated to `new_key`.
        current = _fernet()

        migrated = 0
        failed_ids = []

        with transaction.atomic():
            for identity in ReportIdentity.objects.all().iterator():
                try:
                    plaintext = current.decrypt(identity.encrypted_reporter_ref.encode())
                except Exception:
                    failed_ids.append(str(identity.id))
                    continue
                identity.encrypted_reporter_ref = new_fernet.encrypt(plaintext).decode()
                identity.save(update_fields=['encrypted_reporter_ref'])
                migrated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Re-encrypted {migrated} ReportIdentity row(s) under the new key.'
        ))
        if failed_ids:
            self.stdout.write(self.style.ERROR(
                f'{len(failed_ids)} row(s) could not be decrypted under any key currently in '
                f'FERNET_KEYS and were NOT migrated — this is a data-integrity issue, investigate '
                f'before proceeding: {failed_ids}'
            ))

        self.stdout.write(
            '\nNext steps:\n'
            '  1. Prepend the new key to FERNET_KEYS in your deployment secrets (comma-separated,\n'
            '     newest first) and restart the app.\n'
            '  2. Keep the old key(s) in FERNET_KEYS until you have verified the app is healthy\n'
            '     and this run had zero failures.\n'
            '  3. Once confident, drop the retired key(s) from FERNET_KEYS in a follow-up deploy.\n'
        )
