from django.db import migrations
from apps.accounts.role_seed_data import seed


def forward(apps, schema_editor):
    """
    Phase 4 role/permission redesign, catalogue half. Re-runs the same
    idempotent seed() used by migrations 0004/0008/0009 against the
    now-updated role_seed_data.py: creates the new 'responder' role
    (empty permission set — see role_seed_data.py's comment on why),
    and detaches 'manage_audit_logs' from every role that held it
    (security/ict_admin/management/system_admin) via each role's
    permissions.set(...) being fully replaced. seed() only get_or_creates
    permissions, though, so it never deletes a Permission row that's no
    longer listed — explicitly delete the now-orphaned 'manage_audit_logs'
    row afterward, same pattern as migration 0009's reveal_identity
    removal.
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)
    Permission.objects.filter(slug='manage_audit_logs').delete()


def reverse(apps, schema_editor):
    """
    Restores manage_audit_logs as a permission and re-attaches it to the
    four roles that held it. Does not delete the 'responder' role (that's
    handled by the paired data migration 0011, which depends on this one
    for the role's existence and must be reversed first).
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    manage_audit_logs, _ = Permission.objects.get_or_create(
        slug='manage_audit_logs',
        defaults={'label': 'Manage Audit Logs', 'description': 'View and export the full audit log.', 'category': 'audit'},
    )
    for slug in ('security', 'ict_admin', 'management', 'system_admin'):
        role = Role.objects.filter(slug=slug).first()
        if role:
            role.permissions.add(manage_audit_logs)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_remove_reveal_identity_permission'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
