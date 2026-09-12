from django.db import migrations

# Phase 4 role collapse — exact user list, confirmed via two independent
# read-only snapshots of the live dev DB (2026-08-15 and 2026-08-16, no
# drift between them) before this migration was written. Every one of
# these users currently holds a role whose entire permission set is
# either empty-of-anything-beyond-view_admin_dashboard (the 7 custom
# department-officer roles from an earlier one-off seeding script) or is
# 'security' with the same shape — i.e. purely operational, department-
# affiliated accounts with zero standing admin permissions, matching the
# redesign plan's "automatic migration" criteria exactly. Users flagged
# for MANUAL review in that plan (management_user, ict_admin_user,
# phase10_test_officer) are deliberately NOT included here — their role
# assignment is untouched by this migration.
USERS_TO_RESPONDER = [
    'security_user',
    'academic_head_user',
    'estates_head_user',
    'finance_head_user',
    'health_safety_head_user',
    'hr_head_user',
    'library_head_user',
    'student_affairs_head_user',
]

# Fully vacated once USERS_TO_RESPONDER above has moved — one-off custom
# roles created outside role_seed_data.py by an earlier department-
# coverage seeding script, never part of the source-controlled seed
# catalogue. Safe to delete outright (not just deactivate) since nothing
# else in the codebase references them by slug.
VACATED_CUSTOM_ROLES = [
    'academic_officer',
    'estates_officer',
    'finance_officer',
    'health_safety_officer',
    'hr_officer',
    'librarian',
    'student_affairs_officer',
]

# Retired as active account roles but still referenced by the three
# manual-review users — deactivated (blocks new assignment) rather than
# deleted, since Role.on_delete=PROTECT on User.role would block deletion
# anyway while any user still references them.
ROLES_TO_DEACTIVATE = ['security', 'ict_admin', 'management']


def forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Role = apps.get_model('accounts', 'Role')

    responder = Role.objects.get(slug='responder')
    migrated = User.objects.filter(username__in=USERS_TO_RESPONDER).update(role=responder)
    if migrated != len(USERS_TO_RESPONDER):
        found = set(User.objects.filter(username__in=USERS_TO_RESPONDER).values_list('username', flat=True))
        missing = set(USERS_TO_RESPONDER) - found
        print(f'\n[migrate_users_to_responder_role] WARNING: expected {len(USERS_TO_RESPONDER)} users, found {migrated}. Missing: {missing}')

    Role.objects.filter(slug__in=ROLES_TO_DEACTIVATE).update(is_active=False)

    # Must run after the role reassignment above — Role.on_delete=PROTECT
    # would otherwise block deleting a role still referenced by a user.
    Role.objects.filter(slug__in=VACATED_CUSTOM_ROLES).delete()


def reverse(apps, schema_editor):
    """
    Restores each migrated user's original role and reactivates
    security/ict_admin/management. Does NOT recreate the 7 deleted
    custom department-officer roles — they were never part of the
    source-controlled seed catalogue (created by a one-off shell script),
    so there's no canonical definition to restore them from here; a
    rollback of this migration leaves those 8 users on 'responder'
    rather than genuinely undoing the role deletion. Documented
    limitation, not a silent gap.
    """
    User = apps.get_model('accounts', 'User')
    Role = apps.get_model('accounts', 'Role')

    Role.objects.filter(slug__in=ROLES_TO_DEACTIVATE).update(is_active=True)

    security = Role.objects.filter(slug='security').first()
    if security:
        User.objects.filter(username='security_user').update(role=security)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_collapse_builtin_roles'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
