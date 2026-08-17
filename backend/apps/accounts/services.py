import logging
import secrets
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from apps.notifications.tasks import send_email_task

User = get_user_model()

logger = logging.getLogger(__name__)


def blacklist_all_tokens_for(user):
    """
    Blacklists every outstanding refresh token for `user` — used on a
    self-service password change and on an admin deactivation, so a
    previously-issued (and potentially leaked) refresh token can't outlive
    either event.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def filter_users(queryset, params):
    role = params.get('role')
    is_active = params.get('is_active')
    search = params.get('search')

    if role:
        roles = [r.strip() for r in role.split(',') if r.strip()]
        if roles:
            queryset = queryset.filter(role__slug__in=roles)
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active.lower() == 'true')
    if search:
        queryset = queryset.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
        )

    return queryset


class PasswordResetService:
    @staticmethod
    def request_reset(email):
        """
        Emails a reset link if `email` matches an account. Always returns
        silently regardless of whether a match was found, so the caller
        can't use response timing/shape to enumerate registered emails.
        """
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

        send_email_task.delay(
            user.email,
            "Reset your LUERS password",
            (
                f"Hi {user.username},\n\n"
                f"Use the link below to reset your LUERS password. "
                f"If you didn't request this, you can ignore this email.\n\n"
                f"{reset_url}\n"
            ),
        )

    @staticmethod
    def confirm_reset(uid, token, new_password):
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise DRFValidationError({"detail": "This reset link is invalid."})

        if not default_token_generator.check_token(user, token):
            raise DRFValidationError({"detail": "This reset link is invalid or has expired."})

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            raise DRFValidationError({"new_password": e.messages})

        user.set_password(new_password)
        user.save(update_fields=["password"])


class AccountProvisioningService:
    """
    Shared creation path for accounts that get invited in rather than
    self-registering: department heads (DepartmentHeadCreateView) and
    responders (DepartmentResponderCreateView). Unlike PasswordResetService
    (unusable password + reset-link email, for an account that already
    exists), this gives the new account a real, usable temp password so
    the recipient can log in immediately — `must_change_password=True`
    then forces them to pick their own before doing anything else (see
    ChangePasswordSerializer.save, which clears the flag).
    """

    @staticmethod
    def create_account(*, role, **user_fields):
        temp_password = secrets.token_urlsafe(12)
        user = User.objects.create_user(
            password=temp_password, role=role, must_change_password=True, **user_fields,
        )
        AccountProvisioningService._send_invite_email(user, temp_password)
        return user

    @staticmethod
    def _send_invite_email(user, temp_password):
        login_url = f"{settings.FRONTEND_URL}/login"
        send_email_task.delay(
            user.email,
            "Your LUERS account has been created",
            (
                f"Hi {user.username},\n\n"
                f"An account has been created for you on LUERS. Sign in here:\n\n"
                f"{login_url}\n\n"
                f"Username: {user.username}\n"
                f"Temporary password: {temp_password}\n\n"
                f"You'll be required to choose a new password the first time you sign in.\n"
            ),
        )
