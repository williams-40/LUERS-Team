from django.db import migrations, models


def backfill_reporter_hash(apps, schema_editor):
    """
    Recompute reporter_hash for any existing ReportIdentity rows by decrypting
    encrypted_reporter_ref with the current FERNET_KEY and re-hashing with
    EncryptionService.hash_for_lookup. Rows that fail to decrypt (e.g. legacy
    plaintext PLACEHOLDER_ refs from before encryption was wired up) are
    backfilled directly from the embedded user id instead.
    """
    from apps.core.services import EncryptionService

    ReportIdentity = apps.get_model('reports', 'ReportIdentity')
    for identity in ReportIdentity.objects.all():
        ref = identity.encrypted_reporter_ref
        user_id = None

        decrypted = EncryptionService.decrypt(ref)
        if decrypted and decrypted.startswith('REF_'):
            user_id = decrypted.replace('REF_', '')
        elif ref.startswith('PLACEHOLDER_') and ref != 'PLACEHOLDER_ANONYMOUS':
            user_id = ref.replace('PLACEHOLDER_', '')

        if user_id:
            identity.reporter_hash = EncryptionService.hash_for_lookup(user_id)
            identity.save(update_fields=['reporter_hash'])


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
