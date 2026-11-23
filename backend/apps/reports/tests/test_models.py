import pytest
from apps.core.factories import UserFactory, ReportFactory
from apps.core.choices import Status

@pytest.mark.django_db
def test_report_creation():
    user = UserFactory()
    report = ReportFactory()
    assert report.id is not None
    assert report.status == Status.NEW
