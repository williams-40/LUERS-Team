from django.db import migrations, models


def backfill_reporter_hash(apps, schema_editor):
    """
    Historically recomputed reporter_hash for existing ReportIdentity rows
    by decrypting encrypted_reporter_ref (via the now-deleted
    EncryptionService, removed along with the rest of the anonymous-
    reporting/identity-escrow feature — see reports/0010, which drops the
    ReportIdentity model this field lives on entirely). That target model
    is gone, so this is now a no-op on any database migrated from scratch
    — kept as a no-op rather than deleted so the migration history stays
    linear and this file's own dependency chain doesn't need rewriting.
    Editing this function does not affect a database where it already
    ran (Django only replays un-applied migrations).
    """
    pass


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0004_alter_report_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='reportidentity',
            name='reporter_hash',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddIndex(
            model_name='reportidentity',
            index=models.Index(fields=['reporter_hash'], name='report_iden_reporte_e4a1b0_idx'),
        ),
        migrations.RunPython(backfill_reporter_hash, noop),
    ]
