"""
Single source of truth for the built-in Permission/Role seed data — used by
both migration 0004 (real deploys) and conftest.py's session fixture (tests
run with pytest.ini's --nomigrations, which skips RunPython data migrations
entirely, so tests need this seeded a different way against the same data).
"""

PERMISSIONS = [
    # slug, label, description, category
    ('create_report', 'Create Report', "Submit new incident reports.", 'reports'),
    ('view_admin_dashboard', 'View Admin Dashboard', "Access the admin dashboard, trends, analytics, and report queue export.", 'dashboard'),
    ('manage_users', 'Manage Users', "Create, view, and edit user accounts.", 'accounts'),
    ('manage_departments', 'Manage Departments', "Create and edit departments, heads, and members.", 'departments'),
    ('delete_report', 'Delete Report', "Soft-delete, restore, and view deleted reports.", 'reports'),
    ('manage_roles', 'Manage Roles', "Create, edit, and delete roles and their permission assignments.", 'accounts'),
    ('view_all_reports', 'View All Reports', "Bypass department scoping to see every report and audit log campus-wide.", 'reports'),
]

# role slug -> (label, [permission slugs])
BUILTIN_ROLES = {
    'student': ('Student', ['create_report']),
    'staff': ('Staff', ['create_report']),
    # Phase 4: the target role model. Responder capabilities (view/update
    # assigned reports, upload evidence, department-head authority) are
    # all object-level — see apps.reports.services — department
    # headship/membership is what actually differentiates one responder
    # from another, not the Role. view_admin_dashboard is included here
    # (not left empty) as a deliberate transitional decision: every user
    # migrated into this role by the Phase 4 role-collapse data migration
    # is an existing department head who already held view_admin_dashboard
    # under their old role, and the dedicated department-head/responder
    # dashboard that would let it be removed here doesn't exist yet (that's
    # a later phase). Revisit once that dashboard ships — backend query
    # scoping (get_accessible_reports/get_accessible_audit_logs) is
    # already correct regardless of who holds this permission, so this is
    # a UI-reachability decision, not a data-exposure one.
    'responder': ('Responder', ['view_admin_dashboard']),
    # 'security'/'ict_admin'/'management' — deactivated in accounts/0010,
    # deleted outright in accounts/0013 (2026-08-17 UI-driven cleanup) once
    # their last real references (management_user, ict_admin_user,
    # phase10_test_officer) were removed. No longer seeded here at all —
    # see apps.core.factories for how the test suite still exercises their
    # old permission shapes (SecurityFactory/ManagementFactory now resolve
    # to 'responder', identical single-permission footprint; ICTAdminFactory
    # get_or_creates its own non-builtin, never-seeded test role).
    'system_admin': ('System Admin', [
        'view_admin_dashboard', 'manage_users', 'manage_departments', 'delete_report',
        'manage_roles', 'view_all_reports',
    ]),
}


def seed(permission_model, role_model):
    """Idempotent — safe to call from both a migration (historical models
    via apps.get_model) and a test fixture (real model classes)."""
    perms_by_slug = {}
    for slug, label, description, category in PERMISSIONS:
        perm, _ = permission_model.objects.get_or_create(
            slug=slug, defaults={'label': label, 'description': description, 'category': category}
        )
        perms_by_slug[slug] = perm

    for slug, (label, perm_slugs) in BUILTIN_ROLES.items():
        role, _ = role_model.objects.get_or_create(slug=slug, defaults={'label': label, 'is_builtin': True})
        role.permissions.set([perms_by_slug[s] for s in perm_slugs])
