from django.urls import path
from apps.accounts.views import (
    LoginView, RefreshView, MeView, SecurityOfficersView,
    LogoutView, PasswordResetRequestView, PasswordResetConfirmView,
    ChangePasswordView, AdminUserListCreateView, AdminUserDetailView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('officers/', SecurityOfficersView.as_view(), name='officers'),
    path('users/', AdminUserListCreateView.as_view(), name='admin_user_list_create'),
    path('users/<uuid:id>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
]
