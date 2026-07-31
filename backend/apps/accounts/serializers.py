from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from apps.core.choices import Role
from django.contrib.auth import get_user_model
User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display', 'university_id', 'phone_number', 'date_joined', 'is_active']
        read_only_fields = ['id', 'date_joined']


class OfficerSerializer(serializers.ModelSerializer):
    """Minimal shape for assignment pickers — deliberately excludes email/phone/etc."""
    class Meta:
        model = User
        fields = ['id', 'username']


def _validate_email_unique(instance, value):
    """Shared by MeUpdateSerializer and AdminUserUpdateSerializer — email is
    DB-unique, so without this check a duplicate PATCH throws a 500
    IntegrityError instead of a clean 400."""
    if User.objects.exclude(pk=instance.pk).filter(email__iexact=value).exists():
        raise serializers.ValidationError('A user with this email already exists.')
    return value


class MeUpdateSerializer(serializers.ModelSerializer):
    """
    Self-service profile update. `role`/`university_id`/`username` are
    deliberately absent from Meta.fields (not just read-only) — DRF's
    ModelSerializer only ever accepts fields listed here regardless of what
    the client POSTs, so this is what actually blocks privilege escalation.
    """
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone_number', 'email']

    def validate_email(self, value):
        return _validate_email_unique(self.instance, value)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        user = self.context['request'].user
        try:
            validate_password(value, user=user)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

    def save(self, **kwargs):
        from apps.accounts.services import blacklist_all_tokens_for
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        blacklist_all_tokens_for(user)
        return user


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'role', 'university_id', 'password',
        ]

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Admin-tier account management: role/active-state changes, no
    username/password here — see AdminUserCreateSerializer for creation and
    ChangePasswordSerializer for self-service password changes."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone_number', 'role', 'university_id', 'is_active']

    def validate_email(self, value):
        return _validate_email_unique(self.instance, value)
