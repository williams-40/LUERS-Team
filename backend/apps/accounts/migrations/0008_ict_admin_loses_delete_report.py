from django.db import migrations
from apps.accounts.role_seed_data import seed


def reseed_forward(apps, schema_editor):
    """
    Re-runs the same idempotent seed() from migration 0004 against the
    now-updated role_seed_data.py (ICT Admin no longer carries
    delete_report — only System Admin should be able to delete reports).
    seed()'s role.permissions.set(...) fully replaces each built-in role's
    permission set, so this is the correct way to fix an already-migrated
    database rather than a schema change.
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)


def reseed_backward(apps, schema_editor):
    """Restores delete_report to ict_admin, matching the pre-Phase-17 seed data."""
    Role = apps.get_model('accounts', 'Role')
    Permission = apps.get_model('accounts', 'Permission')
    ict_admin = Role.objects.filter(slug='ict_admin').first()
    delete_report = Permission.objects.filter(slug='delete_report').first()
    if ict_admin and delete_report:
        ict_admin.permissions.add(delete_report)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_finalize_user_role_fk'),
    ]

    operations = [
        migrations.RunPython(reseed_forward, reseed_backward),
    ]
