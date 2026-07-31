from rest_framework.permissions import BasePermission

class IsStudentOrStaff(BasePermission):
    """
    Allows access only to users with role 'student' or 'staff'.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['student', 'staff']

class IsSecurity(BasePermission):
    """
    Allows access only to users with role 'security'.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'security'

class IsICTAdmin(BasePermission):
    """
    Allows access only to users with role 'ict_admin'.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'ict_admin'

class IsManagement(BasePermission):
    """
    Allows access only to users with role 'management' (Escrow Authority).
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'management'

class IsAdminOrManagement(BasePermission):
    """
    Allows access to ICT Admin or Management (for special administrative functions).
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ict_admin', 'management']

class IsAdminTier(BasePermission):
    """
    Allows access to the full admin tier: Security, ICT Admin, Management,
    System Admin. Mirrors the admin-role set used by get_accessible_reports
    and the frontend's ADMIN_ROLES.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            'security', 'ict_admin', 'management', 'system_admin'
        ]

class IsAccountAdmin(BasePermission):
    """
    Allows access only to ICT Admin or System Admin — day-to-day account and
    department administration. Deliberately excludes Management (Escrow
    Authority — a separate governance concern for identity-reveal, see
    IsManagement) and Security.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ict_admin', 'system_admin']
