import factory
from faker import Faker
from apps.reports.models import Report, Evidence, Department
from apps.core.choices import Category, Urgency, Status, Role
from django.contrib.auth import get_user_model
User = get_user_model()

fake = Faker()

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    password = factory.PostGenerationMethodCall('set_password', 'password123')
    role = Role.STUDENT

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        # `role` is a plain slug string on every factory declaration below
        # (Role.STUDENT etc. from apps.core.choices, kept only as a string
        # constant now) — resolve it to the real accounts.models.Role row
        # seeded by migration 0004, so every UserFactory(role='responder')
        # call site across the test suite keeps working unchanged.
        role = kwargs.get('role')
        if isinstance(role, str):
            from apps.accounts.models import Role as RoleModel
            kwargs['role'] = RoleModel.objects.get(slug=role)
        return super()._create(model_class, *args, **kwargs)

class SecurityFactory(UserFactory):
    # security retired as a seeded role (2026-08-17) — its only permission
    # (view_admin_dashboard) is identical to responder's, so this is a
    # like-for-like swap; every existing SecurityFactory() call site across
    # the test suite keeps working unchanged.
    role = Role.RESPONDER

class ManagementFactory(UserFactory):
    # management retired as a seeded role (2026-08-17) — same reasoning as
    # SecurityFactory above (single, identical view_admin_dashboard permission).
    role = Role.RESPONDER

class ICTAdminFactory(UserFactory):
    """
    ict_admin retired as a seeded/production role (2026-08-17) — it's no
    longer creatable, assignable, or shown in the Roles UI. Its permission
    combination (manage_users + manage_departments, deliberately NOT
    manage_roles) is still real, load-bearing test coverage though — most
    importantly the self-promotion-guard suite's "manage_users alone
    cannot promote to system_admin" tests, which have no other existing
    role to exercise that boundary with. Rather than resurrecting a seeded
    Role, get_or_create a non-builtin one scoped to whatever DB this
    factory runs against — it's never referenced by role_seed_data.py or
    any migration, so it's invisible in production and the Roles UI, but
    still gives every existing ICTAdminFactory() call site (~19 files)
    the exact permission shape they were built to test, unchanged.
    """
    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        from apps.accounts.models import Role as RoleModel, Permission
        role, created = RoleModel.objects.get_or_create(
            # Role.slug is max_length=30 — must stay short.
            slug='test_ict_admin_equiv',
            defaults={'label': 'Test: Manage Users (no manage_roles)', 'is_builtin': False, 'is_active': True},
        )
        if created:
            role.permissions.set(
                Permission.objects.filter(slug__in=['view_admin_dashboard', 'manage_users', 'manage_departments'])
            )
        kwargs['role'] = role
        return super()._create(model_class, *args, **kwargs)

class StaffFactory(UserFactory):
    role = Role.STAFF

class ResponderFactory(UserFactory):
    role = Role.RESPONDER

class SystemAdminFactory(UserFactory):
    role = Role.SYSTEM_ADMIN

class DepartmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Department

    name = factory.Sequence(lambda n: f"Test Dept {n}")
    description = factory.LazyAttribute(lambda _: fake.sentence())
    is_active = True

class ReportFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Report

    category = Category.THEFT
    description = factory.LazyAttribute(lambda _: fake.sentence())
    urgency = Urgency.NORMAL
    status = Status.NEW
    latitude = 2.2333
    longitude = 32.8999
    assigned_to = None
