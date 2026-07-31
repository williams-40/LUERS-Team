from django.urls import path
from apps.accounts.views import (
    LoginView, RefreshView, MeView, SecurityOfficersView,
    LogoutView, PasswordResetRequestView, PasswordResetConfirmView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('officers/', SecurityOfficersView.as_view(), name='officers'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
]
