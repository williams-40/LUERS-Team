from django.db import migrations
from apps.accounts.role_seed_data import seed


def forward(apps, schema_editor):
    """
    Re-runs seed() to pick up role_seed_data.py's new
    'manage_emergency_categories' permission and its grant to system_admin —
    same shape as 0016_add_department_head_role.py's re-seed for a later
    addition to role_seed_data.py.
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)


def reverse(apps, schema_editor):
    """Deleting the Permission row cascades off any Role.permissions M2M
    referencing it — no separate role cleanup needed."""
    Permission = apps.get_model('accounts', 'Permission')
    Permission.objects.filter(slug='manage_emergency_categories').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_add_department_head_role'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
