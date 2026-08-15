from rest_framework.permissions import BasePermission


class _HasPermission(BasePermission):
    """
    Base for the require_permission() factory below — DRF instantiates
    every entry in permission_classes with no arguments, so a parameterized
    check needs a class-factory rather than a constructor arg.
    """
    permission_slug = None

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_permission(self.permission_slug)
        )


def require_permission(slug):
    """
    Returns a BasePermission subclass gating on the given permission slug.
    Adding a brand-new capability check anywhere in the app is just
    `require_permission('some_new_slug')` — no new class needed, no schema
    change; just a Permission row and a Role assignment.
    """
    return type(f'Require_{slug}', (_HasPermission,), {'permission_slug': slug})


class IsStudentOrStaff(BasePermission):
    """Allows access to reporters — anyone whose role carries create_report."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_permission('create_report')


class IsSecurity(BasePermission):
    """
    Allows access only to the built-in Security role specifically — not a
    capability, an identity check. Only gates the deliberately-unused-but-kept
    SecurityOfficersView (combined with IsICTAdmin below).
    """
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role_id is not None
            and request.user.role.slug == 'security'
        )


class IsICTAdmin(BasePermission):
    """Allows access only to the built-in ICT Admin role specifically — see IsSecurity."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role_id is not None
            and request.user.role.slug == 'ict_admin'
        )


class IsAdminTier(BasePermission):
    """Allows access to the dashboard/trends/analytics/report-export surface."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_permission('view_admin_dashboard')


# Split out of what used to be one monolithic IsAdminTier/IsAccountAdmin per
# capability, so a future custom role can be granted one without the others —
# see Phase 15 plan. Each of these is a distinct Permission row.
HasAuditAccess = require_permission('manage_audit_logs')
CanManageUsers = require_permission('manage_users')
CanManageDepartments = require_permission('manage_departments')
CanDeleteReport = require_permission('delete_report')
CanManageRoles = require_permission('manage_roles')
CanViewAllReports = require_permission('view_all_reports')
