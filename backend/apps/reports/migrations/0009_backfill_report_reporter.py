from django.db import migrations


def backfill_report_reporter(apps, schema_editor):
    """
    Populated the new Report.reporter FK from the old encrypted
    ReportIdentity table, ahead of dropping that table entirely (removal
    of anonymous reporting / identity-reveal). Originally resolved three
    ref formats — REF_ (Fernet-encrypted, via the now-deleted
    EncryptionService), PLACEHOLDER_, and SEED_ — described in more
    detail in this migration's git history.

    Dry-run verified against the live dev DB before this migration was
    written: 28/28 ReportIdentity rows resolved to a real, existing User
    via that three-branch logic — not the lossy backfill originally
    anticipated in the redesign plan.

    The REF_/EncryptionService branch is removed here: EncryptionService
    was deleted along with the rest of the identity-escrow feature (see
    reports/0010, which drops ReportIdentity itself a migration later),
    so on any database migrated from scratch this loop only ever runs
    against an empty ReportIdentity queryset anyway — the PLACEHOLDER_/
    SEED_ branches are kept as an accurate record of the resolution
    logic that isn't broken by that deletion. Editing this function does
    not affect a database where it already ran (Django only replays
    un-applied migrations).
    """
    Report = apps.get_model('reports', 'Report')
    ReportIdentity = apps.get_model('reports', 'ReportIdentity')
    User = apps.get_model('accounts', 'User')

    resolved, unresolved = 0, 0
    for identity in ReportIdentity.objects.all():
        ref = identity.encrypted_reporter_ref
        user_id = None

        if ref.startswith('PLACEHOLDER_') and ref != 'PLACEHOLDER_ANONYMOUS':
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
