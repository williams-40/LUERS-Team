import pytest
from django.db import IntegrityError
from apps.reports.models import Report, ReportIdentity
from apps.core.factories import UserFactory, ReportFactory
from apps.core.choices import Status

@pytest.mark.django_db
def test_report_creation():
    user = UserFactory()
    report = ReportFactory()
    assert report.id is not None
    assert report.status == Status.NEW

@pytest.mark.django_db
def test_report_identity_creation():
    user = UserFactory()
    report = ReportFactory()
    identity = ReportIdentity.objects.create(
        report=report,
        encrypted_reporter_ref=f"REF_{user.id}"
    )
    assert identity.report == report
    assert identity.encrypted_reporter_ref == f"REF_{user.id}"