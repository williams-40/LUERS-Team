import pytest
from apps.reports.services import ReportService, IdentityService
from apps.reports.models import Report
from apps.core.factories import UserFactory, ReportFactory
from apps.audit.models import AuditLog
from apps.core.choices import Status, Action

@pytest.mark.django_db
def test_create_report():
    user = UserFactory()
    data = {
        'category': 'theft',
        'description': 'Test description',
        'urgency': 'normal',
        'is_anonymous': False,
        'latitude': 2.2333,
        'longitude': 32.8999,
    }
    report = ReportService.create_report(data, user, ip_address='127.0.0.1')
    assert report.status == Status.NEW
    assert AuditLog.objects.filter(report=report, action=Action.CREATE).exists()
    assert IdentityService.identity_exists(report)

@pytest.mark.django_db
def test_update_status():
    user = UserFactory()
    report = ReportFactory()
    result = ReportService.update_status(report, Status.IN_PROGRESS, user, ip_address='127.0.0.1')
    assert result['status'] == Status.IN_PROGRESS
    assert AuditLog.objects.filter(report=report, action=Action.STATUS_UPDATE).exists()