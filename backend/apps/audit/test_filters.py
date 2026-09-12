import pytest
from django.utils import timezone
from datetime import timedelta
from apps.audit.models import AuditLog
from apps.audit.views import filter_audit_logs
from apps.core.factories import ReportFactory, SecurityFactory
from apps.core.choices import Action


@pytest.mark.django_db
def test_filter_by_report():
    report = ReportFactory()
    other_report = ReportFactory()
    actor = SecurityFactory()
    match = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)
    AuditLog.objects.create(report=other_report, actor=actor, action=Action.CREATE)

    result = filter_audit_logs(AuditLog.objects.all(), {'report': str(report.id)})
    assert list(result) == [match]


@pytest.mark.django_db
def test_filter_by_actor():
    report = ReportFactory()
    actor = SecurityFactory()
    other_actor = SecurityFactory()
    match = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)
    AuditLog.objects.create(report=report, actor=other_actor, action=Action.CREATE)

    result = filter_audit_logs(AuditLog.objects.all(), {'actor': str(actor.id)})
    assert list(result) == [match]


@pytest.mark.django_db
def test_filter_by_action():
    report = ReportFactory()
    actor = SecurityFactory()
    match = AuditLog.objects.create(report=report, actor=actor, action=Action.STATUS_UPDATE)
    AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    result = filter_audit_logs(AuditLog.objects.all(), {'action': Action.STATUS_UPDATE})
    assert list(result) == [match]


@pytest.mark.django_db
def test_filter_by_date_from_and_date_to():
    report = ReportFactory()
    actor = SecurityFactory()
    entry = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    now = timezone.now()
    date_from = (now - timedelta(days=1)).isoformat()
    date_to = (now + timedelta(days=1)).isoformat()

    result = filter_audit_logs(AuditLog.objects.all(), {'date_from': date_from, 'date_to': date_to})
    assert list(result) == [entry]


@pytest.mark.django_db
def test_date_from_excludes_entries_before_it():
    report = ReportFactory()
    actor = SecurityFactory()
    AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    future_date_from = (timezone.now() + timedelta(days=1)).isoformat()
    result = filter_audit_logs(AuditLog.objects.all(), {'date_from': future_date_from})
    assert list(result) == []


@pytest.mark.django_db
def test_malformed_date_from_is_silently_ignored():
    report = ReportFactory()
    actor = SecurityFactory()
    entry = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    result = filter_audit_logs(AuditLog.objects.all(), {'date_from': 'not-a-date'})
    assert list(result) == [entry]


@pytest.mark.django_db
def test_malformed_date_to_is_silently_ignored():
    report = ReportFactory()
    actor = SecurityFactory()
    entry = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    result = filter_audit_logs(AuditLog.objects.all(), {'date_to': 'garbage'})
    assert list(result) == [entry]


@pytest.mark.django_db
def test_naive_date_is_made_timezone_aware():
    report = ReportFactory()
    actor = SecurityFactory()
    entry = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    naive_date_from = (timezone.now() - timedelta(days=1)).replace(tzinfo=None).isoformat()
    result = filter_audit_logs(AuditLog.objects.all(), {'date_from': naive_date_from})
    assert list(result) == [entry]


@pytest.mark.django_db
def test_no_filters_returns_everything():
    report = ReportFactory()
    actor = SecurityFactory()
    entry = AuditLog.objects.create(report=report, actor=actor, action=Action.CREATE)

    result = filter_audit_logs(AuditLog.objects.all(), {})
    assert list(result) == [entry]
