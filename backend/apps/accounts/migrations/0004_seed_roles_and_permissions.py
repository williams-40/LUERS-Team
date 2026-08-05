from django.db import migrations
from apps.accounts.role_seed_data import seed, PERMISSIONS, BUILTIN_ROLES


def seed_forward(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')
    seed(Permission, Role)


def seed_backward(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    Permission = apps.get_model('accounts', 'Permission')
    Role.objects.filter(slug__in=BUILTIN_ROLES.keys()).delete()
    Permission.objects.filter(slug__in=[p[0] for p in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_permission_role'),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
