from django.db import migrations

# UI-driven decision (2026-08-17): the dev environment accumulated ~11
# department-head/responder accounts created ad hoc through the admin UI
# during development, with no real provisioning chain behind them. Reset
# to the 3 accounts that always exist by design — everything else
# (heads, responders) now comes into existence only through the new
# DepartmentHeadCreateView/DepartmentResponderCreateView provisioning
# flow, never ad hoc.
PROTECTED_USERNAMES = ['system_admin_user', 'student_user', 'staff_user']


def forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Department = apps.get_model('reports', 'Department')
    # Report.reporter/assigned_to, Department.head, AuditLog.actor are all
    # SET_NULL — reports/departments/audit history survive, just lose the
    # dangling reference. Notification.recipient and Message.sender are
    # CASCADE — any chat messages these accounts sent on any report are
    # deleted along with them. Disclosed, not silently worked around.
    User.objects.exclude(username__in=PROTECTED_USERNAMES).delete()

    # Every department starts headless — headship becomes a deliberate
    # DepartmentHeadCreateView action from here on, not leftover seed
    # state. Explicit, not just a side effect of the delete above: a
    # protected account (system_admin_user, from an older seed_data.py
    # run) could still be heading a department at this point.
    Department.objects.filter(head__isnull=False).update(head=None)


def reverse(apps, schema_editor):
    """
    No-op: matches migration 0013's own precedent for this exact
    situation. The deleted accounts' passwords, department headships, and
    any other state are gone — a rollback of this migration cannot
    recreate them, only the 3 protected accounts were never touched.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_delete_legacy_roles'),
        # forward() touches apps.reports.Department via apps.get_model —
        # explicit, since Django's default topological sort otherwise
        # gives no ordering guarantee between unrelated apps' migrations
        # on a fresh install.
        ('reports', '0011_drop_assistance_models'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
