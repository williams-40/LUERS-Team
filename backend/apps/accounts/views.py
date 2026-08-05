from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.accounts.serializers import (
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    ChangePasswordSerializer,
    MeUpdateSerializer,
    OfficerSerializer,
    UserSerializer,
)
from apps.accounts.services import PasswordResetService, blacklist_all_tokens_for, filter_users
from apps.accounts.permissions import CanManageUsers, IsSecurity, IsICTAdmin
from apps.core.pagination import StandardPagination

User = get_user_model()

LOGIN_LOCKOUT_THRESHOLD = 5
LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60


def _login_lockout_key(username: str) -> str:
    return f"login_lockout:{username.strip().lower()}"


def _register_failed_login(username: str) -> None:
    key = _login_lockout_key(username)
    cache.add(key, 0, LOGIN_LOCKOUT_WINDOW_SECONDS)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, LOGIN_LOCKOUT_WINDOW_SECONDS)


@method_decorator(ratelimit(key='ip', rate='10/m', method='POST', block=True), name='post')
class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Returns access and refresh tokens. Rate-limited by IP, and additionally
    locks out a *username* for 15 minutes after 5 failed attempts regardless
    of source IP, to blunt distributed/credential-stuffing attempts that a
    per-IP limit alone wouldn't catch.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        username = str(request.data.get('username', ''))
        lockout_key = _login_lockout_key(username) if username else None

        if lockout_key and cache.get(lockout_key, 0) >= LOGIN_LOCKOUT_THRESHOLD:
            return Response(
                {'detail': 'Too many failed login attempts. Please try again in a few minutes.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # TokenObtainPairView.post() *raises* AuthenticationFailed on bad
        # credentials rather than returning a non-200 Response — it doesn't
        # fall through to a status-code check below.
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            if lockout_key:
                _register_failed_login(username)
            raise

        if lockout_key:
            cache.delete(lockout_key)

        return response


@method_decorator(ratelimit(key='ip', rate='10/m', method='POST', block=True), name='post')
class RefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Returns a new access token using a valid refresh token.
    """
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the given refresh token so it can't be used again, closing
    the gap where clearing tokens client-side left a still-valid refresh
    token usable until its natural 7-day expiry.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            return Response({'detail': 'refresh is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            pass  # already invalid/expired — logout still succeeds from the client's perspective
        return Response(status=status.HTTP_205_RESET_CONTENT)


@method_decorator(ratelimit(key='ip', rate='5/h', method='POST', block=True), name='post')
class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/
    Always responds the same way regardless of whether the email matches an
    account, so the response can't be used to enumerate registered users.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        if email:
            PasswordResetService.request_reset(email)
        return Response({'detail': 'If an account exists for that email, a reset link has been sent.'})


@method_decorator(ratelimit(key='ip', rate='10/h', method='POST', block=True), name='post')
class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        if not (uid and token and new_password):
            return Response(
                {'detail': 'uid, token, and new_password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        PasswordResetService.confirm_reset(uid, token, new_password)
        return Response({'detail': 'Password has been reset.'})


class MeView(APIView):
    """
    GET /api/v1/auth/me/
    Returns the current authenticated user's profile.

    PATCH /api/v1/auth/me/
    Self-service update of first_name/last_name/phone_number/email — see
    MeUpdateSerializer for why role/university_id/username can't be changed
    here.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/
    Self-service password change, requiring the current password. Blacklists
    all of the user's outstanding refresh tokens on success (see
    ChangePasswordSerializer.save) so a leaked refresh token can't outlive
    the change.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password updated.'})


class AdminUserListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/auth/users/
    List users, filterable by role (comma-separated), is_active, and search
    (username/email/first_name/last_name). ICT Admin / System Admin only.

    POST /api/v1/auth/users/
    Create a new account — the only non-shell way to provision a user now
    that this phase exists.
    """
    permission_classes = [IsAuthenticated, CanManageUsers]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        return AdminUserCreateSerializer if self.request.method == 'POST' else UserSerializer

    def get_queryset(self):
        return filter_users(User.objects.all().order_by('username'), self.request.query_params)

    def create(self, request, *args, **kwargs):
        # AdminUserCreateSerializer's own representation would return `role`
        # as a bare slug (SlugRelatedField) rather than the nested
        # role+permissions shape every other endpoint returns — re-serialize
        # the saved instance through UserSerializer so the response is
        # consistent everywhere.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(UserSerializer(serializer.instance).data, status=status.HTTP_201_CREATED, headers=headers)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/v1/auth/users/<id>/
    Admin-tier account management: role changes, deactivation via
    `is_active`. No DELETE — deactivation is the only supported removal
    path. Deactivating a user (is_active True -> False) blacklists their
    outstanding refresh tokens so a live session can't outlive the change.
    """
    permission_classes = [IsAuthenticated, CanManageUsers]
    queryset = User.objects.all()
    lookup_field = 'id'

    def get_serializer_class(self):
        return AdminUserUpdateSerializer if self.request.method == 'PATCH' else UserSerializer

    def perform_update(self, serializer):
        was_active = serializer.instance.is_active
        user = serializer.save()
        if was_active and not user.is_active:
            blacklist_all_tokens_for(user)

    def update(self, request, *args, **kwargs):
        # Same reshaping as AdminUserListCreateView.create() above — the
        # PATCH input serializer's own representation is a bare role slug.
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(UserSerializer(serializer.instance).data)


class SecurityOfficersView(generics.ListAPIView):
    """
    GET /api/v1/auth/officers/
    Lists security officers for assignment pickers. Same role gate as
    ReportAssignView (IsSecurity|IsICTAdmin) since that's the only place
    this list is used.
    """
    serializer_class = OfficerSerializer
    permission_classes = [IsAuthenticated, IsSecurity | IsICTAdmin]
    pagination_class = None
    queryset = User.objects.filter(role__slug='security').order_by('username')
