import factory
from faker import Faker
from apps.reports.models import Report, Evidence, ReportIdentity, Department
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
        # seeded by migration 0004, so every UserFactory(role='security')
        # call site across the test suite keeps working unchanged.
        role = kwargs.get('role')
        if isinstance(role, str):
            from apps.accounts.models import Role as RoleModel
            kwargs['role'] = RoleModel.objects.get(slug=role)
        return super()._create(model_class, *args, **kwargs)

class SecurityFactory(UserFactory):
    role = Role.SECURITY

class ICTAdminFactory(UserFactory):
    role = Role.ICT_ADMIN

class ManagementFactory(UserFactory):
    role = Role.MANAGEMENT

class StaffFactory(UserFactory):
    role = Role.STAFF

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
    is_anonymous = False
    latitude = 2.2333
    longitude = 32.8999
    assigned_to = None

class AnonymousReportFactory(ReportFactory):
    is_anonymous = True
