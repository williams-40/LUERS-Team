from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from apps.accounts.models import Role
from apps.accounts.serializers_role import RoleSerializer
from django.contrib.auth import get_user_model
User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    `role` is nested metadata only (slug/label/description/is_builtin) — no
    booleans. `permissions` is a flat, efficient slug list straight from the
    user's role, so the frontend can gate on it without extra API calls.
    """
    role = RoleSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'permissions', 'university_id', 'phone_number', 'date_joined', 'is_active', 'must_change_password']
        read_only_fields = ['id', 'date_joined']

    def get_permissions(self, obj):
        if not obj.role_id:
            return []
        return sorted(obj.role.permissions.values_list('slug', flat=True))


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


def _is_privileged_role(role):
    """
    A role that can itself grant system-administrator-level access: the
    system_admin role, or any role — built-in or custom — that carries
    manage_roles. Assigning a user into one of these is treated as
    equivalent to granting manage_roles directly.
    """
    return role.slug == 'system_admin' or role.permissions.filter(slug='manage_roles').exists()


def _validate_role_assignment(serializer, value):
    """
    Shared self-promotion guard for AdminUserCreateSerializer/
    AdminUserUpdateSerializer (Phase 4):
      - No user may ever change their own role field, through this or any
        other endpoint, regardless of what permission they hold — an
        unconditional rule, not a permission-gated exception, so a
        system_admin can't "confirm" a self-downgrade/upgrade either.
      - Assigning a user into system_admin, or any role carrying
        manage_roles, itself requires the acting user to hold
        manage_roles — manage_users alone is not enough. Without this, a
        manage_users holder (e.g. a future non-system_admin role granted
        it) could promote any account, including their own, to
        system_admin despite never having been granted manage_roles.
      - Post-Phase-9 cleanup: nobody may newly assign a user into
        `responder` through this general path anymore — creating a
        responder account is exclusively DepartmentResponderCreateView's
        job now, so it's tied to a real department headship rather than
        handed out by anyone holding manage_users. The one exception is a
        no-op save on an account that's already a responder (editing its
        email/active-state etc. without touching role), which must keep
        working.
    """
    request = serializer.context.get('request')
    actor = getattr(request, 'user', None)

    target = serializer.instance
    if actor is not None and target is not None and target.id == actor.id:
        raise serializers.ValidationError("You cannot change your own role.")

    if _is_privileged_role(value) and not (actor and actor.has_permission('manage_roles')):
        raise serializers.ValidationError(
            "Only a user with manage_roles can assign this role."
        )

    if value.slug == 'responder' and not (target is not None and target.role_id == value.id):
        raise serializers.ValidationError(
            "Responder accounts can only be created through a department head's own responder-creation endpoint."
        )

    if value.slug == 'department_head' and not (target is not None and target.role_id == value.id):
        raise serializers.ValidationError(
            "Department head accounts can only be created through a system admin's head-creation endpoint."
        )

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
        # Doubles as the forced first-login change for temp-password
        # accounts (AccountProvisioningService) — this is the one place
        # that flag gets cleared, so a no-op re-save of an already-cleared
        # account is harmless.
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password'])
        blacklist_all_tokens_for(user)
        return user


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.SlugRelatedField(slug_field='slug', queryset=Role.objects.filter(is_active=True))

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

    def validate_role(self, value):
        return _validate_role_assignment(self, value)

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class SelfRegisterSerializer(serializers.ModelSerializer):
    """
    Public self-registration (unauthenticated, AllowAny). There is no actor
    to check for _validate_role_assignment's self-promotion/manage_roles
    rules, so this doesn't reuse it — restriction to the two lowest-
    privilege reporter roles is enforced purely by the `role` field's
    queryset (student/staff only; anything else 400s as "does not exist"),
    the same way ResponderCreateSerializer/HeadCreateSerializer restrict
    their roles by construction rather than by an actor-aware check.
    """
    password = serializers.CharField(write_only=True)
    role = serializers.SlugRelatedField(
        slug_field='slug', queryset=Role.objects.filter(is_active=True, slug__in=['student', 'staff']),
    )

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


class ResponderCreateSerializer(serializers.ModelSerializer):
    """
    Phase 6: department-scoped responder account creation
    (DepartmentResponderCreateView). No `role`, `department`, or
    `password` field is even listed here — role is hardcoded to
    `responder` server-side (see `role_slug`), department comes from the
    URL only, and the account gets a temp password the recipient is
    emailed directly (AccountProvisioningService) rather than ever having
    a credential transit this endpoint at all. Mirrors MeUpdateSerializer's
    established field-omission pattern for blocking privilege escalation
    (absent, not just read-only). Duplicate username/email are already
    caught by the model's own unique=True constraints via DRF's automatic
    UniqueValidator, matching AdminUserCreateSerializer's behavior.

    Also the base for HeadCreateSerializer below — a department head and a
    department's responders are provisioned identically (temp password,
    forced change on first login), differing only in what happens to the
    resulting user afterward (member vs. head) — that difference lives in
    the two views, not here.
    """
    role_slug = 'responder'

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'university_id']

    def create(self, validated_data):
        from apps.accounts.services import AccountProvisioningService
        role = Role.objects.get(slug=self.role_slug, is_active=True)
        return AccountProvisioningService.create_account(role=role, **validated_data)


class HeadCreateSerializer(ResponderCreateSerializer):
    """
    Phase C: system_admin-only department-head creation
    (DepartmentHeadCreateView). Identical shape to ResponderCreateSerializer
    — same field omissions, same provisioning mechanism — but the created
    account holds the dedicated `department_head` role (see `role_slug`
    override below), not `responder`. `Department.head_id`/`members` is
    still what actually scopes a head's authority to their own department
    (see DepartmentWriteSerializer's own docstring and
    apps.reports.services's relationship helpers) — the role only exists
    to keep department heads out of `responder`-only accounting (e.g.
    "who is an assignable responder") and out of general user-management's
    role picker.
    """
    role_slug = 'department_head'


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Admin-tier account management: role/active-state changes, no
    username/password here — see AdminUserCreateSerializer for creation and
    ChangePasswordSerializer for self-service password changes."""
    role = serializers.SlugRelatedField(slug_field='slug', queryset=Role.objects.filter(is_active=True))

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone_number', 'role', 'university_id', 'is_active']

    def validate_email(self, value):
        return _validate_email_unique(self.instance, value)

    def validate_role(self, value):
        return _validate_role_assignment(self, value)

    def validate_is_active(self, value):
        """
        Phase 8: unconditional guard mirroring `_validate_role_assignment`'s
        self-role-edit rule — no user may deactivate their own account
        through this endpoint, regardless of what permission they hold.
        Without it, a manage_users holder (most severely, the only
        system_admin) could PATCH their own account inactive and
        immediately lock themselves out (SimpleJWT rechecks `is_active` on
        every request, so this takes effect the moment it's saved).
        """
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        target = self.instance
        if value is False and actor is not None and target is not None and target.id == actor.id:
            raise serializers.ValidationError("You cannot deactivate your own account.")
        return value
