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
