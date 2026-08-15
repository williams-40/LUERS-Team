from django.db import migrations


def backfill_report_reporter(apps, schema_editor):
    """
    Populate the new Report.reporter FK from the old encrypted
    ReportIdentity table, ahead of dropping that table entirely (removal
    of anonymous reporting / identity-reveal). Reuses the exact decode
    logic already proven in migration 0005_reportidentity_reporter_hash
    (REF_/PLACEHOLDER_ prefixes) and adds a third branch for the SEED_
    prefix written directly by apps.core.management.commands.seed_data
    (format: "SEED_{user_id}_{random 4 digits}", bypassing encryption
    entirely — never previously parsed by any decode path in this
    codebase, including apps.core.management.commands.rotate_fernet_key).

    Dry-run verified against the live dev DB before this migration was
    written: 28/28 ReportIdentity rows resolve to a real, existing User
    via this three-branch logic — not the lossy backfill originally
    anticipated in the redesign plan (which only accounted for the first
    two branches).
    """
    from apps.core.services import EncryptionService

    Report = apps.get_model('reports', 'Report')
    ReportIdentity = apps.get_model('reports', 'ReportIdentity')
    User = apps.get_model('accounts', 'User')

    resolved, unresolved = 0, 0
    for identity in ReportIdentity.objects.all():
        ref = identity.encrypted_reporter_ref
        user_id = None

        decrypted = EncryptionService.decrypt(ref)
        if decrypted and decrypted.startswith('REF_'):
            user_id = decrypted.replace('REF_', '')
        elif ref.startswith('PLACEHOLDER_') and ref != 'PLACEHOLDER_ANONYMOUS':
            user_id = ref.replace('PLACEHOLDER_', '')
        elif ref.startswith('SEED_'):
            user_id = ref[5:].rsplit('_', 1)[0]

        user = User.objects.filter(id=user_id).first() if user_id else None
        if user is not None:
            Report.objects.filter(id=identity.report_id).update(reporter=user)
            resolved += 1
        else:
            unresolved += 1

    if unresolved:
        print(
            f'\n[backfill_report_reporter] WARNING: {unresolved} ReportIdentity row(s) '
            f'could not be resolved to a real user and were left with reporter=NULL. '
            f'{resolved} row(s) resolved successfully.'
        )


def reverse_backfill(apps, schema_editor):
    """Clears reporter back to NULL on every report — non-destructive, ReportIdentity is untouched by this migration either way."""
    Report = apps.get_model('reports', 'Report')
    Report.objects.exclude(reporter__isnull=True).update(reporter=None)


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0008_add_report_reporter'),
    ]

    operations = [
        migrations.RunPython(backfill_report_reporter, reverse_backfill),
    ]
