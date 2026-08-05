from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.core.models import BaseModel


class Permission(BaseModel):
    """
    A flat capability catalogue — no hierarchy, no inheritance. Adding a new
    capability means adding one row here and attaching it to whichever
    Role(s) need it; no schema change and no code change at the call site
    that already checks this slug (see User.has_permission).
    """
    slug = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'permissions'
        ordering = ['category', 'slug']

    def __str__(self):
        return self.slug


class Role(BaseModel):
    """
    Metadata only — capabilities live on the Permission M2M, not as booleans
    here. `is_builtin` roles (the original student/staff/security/ict_admin/
    management/system_admin set) are locked against edits/deletes via the
    Role CRUD API (see serializers_role.py) to protect what those role names
    mean; everything else is a System-Admin-manageable custom role.
    """
    slug = models.SlugField(max_length=30, unique=True)
    label = models.CharField(max_length=50)
    description = models.CharField(max_length=255, blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name='roles')
    is_builtin = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'roles'
        ordering = ['label']

    def __str__(self):
        return self.slug


class User(BaseModel, AbstractUser):
    # AbstractUser already provides: username, email, password, first_name, last_name, is_active, date_joined
    # We'll override email to be unique
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='users')
    university_id = models.CharField(max_length=50, blank=True, null=True)

    USERNAME_FIELD = 'username'   # default, but we could set email if desired
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['university_id']),
        ]

    def __str__(self):
        return self.username

    def has_permission(self, slug):
        """Cached per-instance so repeated checks in one request don't
        re-query — the class-based DRF permission checks below and the
        object-level helpers in apps.reports.services both call this."""
        if not hasattr(self, '_permission_slugs'):
            self._permission_slugs = (
                set(self.role.permissions.values_list('slug', flat=True)) if self.role_id else set()
            )
        return slug in self._permission_slugs

    def has_any_permission(self, slugs):
        return any(self.has_permission(s) for s in slugs)
