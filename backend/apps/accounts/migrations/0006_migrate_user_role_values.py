from django.db import migrations


def migrate_forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Role = apps.get_model('accounts', 'Role')
    roles_by_slug = {r.slug: r for r in Role.objects.all()}
    for user in User.objects.all():
        role = roles_by_slug.get(user.role)
        if role is None:
            # Defensive fallback for any stray/unexpected value — 'student'
            # is the same default the old CharField used.
            role = roles_by_slug['student']
        user.role_new = role
        user.save(update_fields=['role_new'])


def migrate_backward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    for user in User.objects.select_related('role_new').all():
        if user.role_new_id:
            user.role = user.role_new.slug
            user.save(update_fields=['role'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_user_role_new'),
    ]

    operations = [
        migrations.RunPython(migrate_forward, migrate_backward),
    ]
