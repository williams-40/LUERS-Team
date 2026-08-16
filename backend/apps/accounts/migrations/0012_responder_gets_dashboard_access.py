from django.db import migrations
from apps.accounts.role_seed_data import seed


def forward(apps, schema_editor):
    """
    Re-runs seed() to pick up role_seed_data.py's updated 'responder'
    entry (now carries view_admin_dashboard). Transitional decision —
    see the comment on BUILTIN_ROLES['responder'] in role_seed_data.py
    for why this wasn't left empty as originally planned: every user
    migration 0011 moved into 'responder' is an existing department head
    who already held view_admin_dashboard under their old role, and the
    dedicated department-head dashboard that would let this be removed
    doesn't exist yet.
    """
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)


def reverse(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    responder = Role.objects.filter(slug='responder').first()
    if responder:
        responder.permissions.clear()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_migrate_users_to_responder_role'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
