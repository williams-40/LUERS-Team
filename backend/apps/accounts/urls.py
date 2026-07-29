# ... existing imports ...
from django.urls import path
from apps.accounts.views import (
    LoginView, RefreshView, MeView, SecurityOfficersView,
    TestSecurityView, TestICTAdminView, TestManagementView, TestStudentStaffView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshView.as_view(), name='refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('officers/', SecurityOfficersView.as_view(), name='officers'),

    # Test endpoints for permissions (remove or keep for debugging)
    path('test/security/', TestSecurityView.as_view(), name='test_security'),
    path('test/ictadmin/', TestICTAdminView.as_view(), name='test_ictadmin'),
    path('test/management/', TestManagementView.as_view(), name='test_management'),
    path('test/studentstaff/', TestStudentStaffView.as_view(), name='test_studentstaff'),
]
