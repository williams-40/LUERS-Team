import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError as DRFValidationError
from apps.notifications.tasks import send_email_task

User = get_user_model()

logger = logging.getLogger(__name__)


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
