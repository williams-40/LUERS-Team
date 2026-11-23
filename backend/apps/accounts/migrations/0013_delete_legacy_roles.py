from django.db import migrations

# The three users flagged for manual review in migration 0011's own
# comment (never auto-migrated to 'responder' there) — explicit UI-driven
# decision (2026-08-17) to delete them entirely rather than reassign, so
# the roles below can actually be deleted (Role.on_delete=PROTECT on
# User.role blocks deletion while any user still references a role).
# management_user headed 'Administration', ict_admin_user headed 'ICT
# Services' — both departments go head=None (Department.head is
# on_delete=SET_NULL) as a direct, disclosed consequence, not silently
# worked around here; assigning a new head is a separate decision.
USERS_TO_DELETE = ['management_user', 'ict_admin_user', 'phase10_test_officer']

ROLES_TO_DELETE = ['security', 'ict_admin', 'management']

# Original label/permission-slug shape, for the (partial) reverse below —
# matches what role_seed_data.py held before this migration removed them.
ROLE_ORIGINALS = {
    'security': ('Security Officer', ['view_admin_dashboard']),
    'ict_admin': ('ICT Admin', ['view_admin_dashboard', 'manage_users', 'manage_departments']),
    'management': ('Management / Escrow', ['view_admin_dashboard']),
}


def forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Role = apps.get_model('accounts', 'Role')

    # Defensive, not just the 3 named accounts: covers any other DB where
    # a stray user still holds one of these roles, so this migration is
    # safe to replay against more than just this project's own dev DB.
    User.objects.filter(username__in=USERS_TO_DELETE).delete()
    User.objects.filter(role__slug__in=ROLES_TO_DELETE).delete()

    Role.objects.filter(slug__in=ROLES_TO_DELETE).delete()


def reverse(apps, schema_editor):
    """
    Recreates the 3 role rows with their original label/permissions —
    fully reversible, since that shape is known and documented above.
    Does NOT restore the deleted users (management_user, ict_admin_user,
    phase10_test_officer) — their original passwords, department
    headships, and any other state are gone; a rollback of this migration
    leaves those roles empty of members rather than genuinely undoing the
    deletion. Documented limitation, matching migration 0011's own
    precedent for this exact situation.
    """
    Role = apps.get_model('accounts', 'Role')
    Permission = apps.get_model('accounts', 'Permission')

    for slug, (label, perm_slugs) in ROLE_ORIGINALS.items():
        role, _ = Role.objects.get_or_create(
            slug=slug, defaults={'label': label, 'is_builtin': True, 'is_active': False},
        )
        role.permissions.set(Permission.objects.filter(slug__in=perm_slugs))


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_responder_gets_dashboard_access'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
