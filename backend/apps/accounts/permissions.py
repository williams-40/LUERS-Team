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
