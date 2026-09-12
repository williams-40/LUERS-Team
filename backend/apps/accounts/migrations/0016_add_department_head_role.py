from django.db import migrations
from apps.accounts.role_seed_data import seed


def forward(apps, schema_editor):
    """
    Re-runs seed() to pick up role_seed_data.py's new 'department_head'
    entry. Department headship was previously a relationship layered on
    the 'responder' role (see HeadCreateSerializer) — from here on, heads
    created via DepartmentHeadCreateView get this dedicated role instead.
    Existing head accounts already migrated to 'responder' by earlier
    phases are NOT retroactively moved here; that would need a data
    migration keyed on Department.head, out of scope for this seed-only
    change.
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)


def reverse(apps, schema_editor):
    """
    No-op if the role is still assigned to users (Role.on_delete=PROTECT
    on User.role would raise on delete anyway) — matches 0013's own
    precedent of not attempting a destructive reverse. Just clears
    permissions like 0012 does, leaving the role row itself in place.
    """
    Role = apps.get_model('accounts', 'Role')
    department_head = Role.objects.filter(slug='department_head').first()
    if department_head:
        department_head.permissions.clear()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_add_must_change_password'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
