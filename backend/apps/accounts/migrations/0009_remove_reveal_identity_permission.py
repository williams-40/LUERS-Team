from django.db import migrations
from apps.accounts.role_seed_data import seed


def forward(apps, schema_editor):
    """
    Re-runs the same idempotent seed() from migration 0004 against the
    now-updated role_seed_data.py (reveal_identity removed from
    PERMISSIONS and from the 'management' role's list) — this detaches
    reveal_identity from 'management' via role.permissions.set(...), same
    mechanism as migration 0008. seed() only get_or_creates permissions,
    though, so it never deletes a Permission row that's no longer listed —
    explicitly delete the now-orphaned 'reveal_identity' row afterward
    (the identity-reveal feature and reveal_identity permission are being
    removed entirely, not just unassigned from this one role).
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)
    Permission.objects.filter(slug='reveal_identity').delete()


def reverse(apps, schema_editor):
    """Restores reveal_identity as a permission and re-attaches it to 'management', matching the pre-Phase-2 seed data."""
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    reveal_identity, _ = Permission.objects.get_or_create(
        slug='reveal_identity',
        defaults={
            'label': 'Reveal Identity',
            'description': "Decrypt and reveal an anonymous reporter's identity.",
            'category': 'reports',
        },
    )
    management = Role.objects.filter(slug='management').first()
    if management:
        management.permissions.add(reveal_identity)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_ict_admin_loses_delete_report'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
