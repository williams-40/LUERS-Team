import pytest
from django.core.management import call_command
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from apps.core.factories import (
    UserFactory, SecurityFactory, ICTAdminFactory, ManagementFactory,
    SystemAdminFactory, ReportFactory, DepartmentFactory,
)
from apps.reports.models import Report, Evidence, ReportIdentity
from apps.reports.services import IdentityService, get_accessible_reports
from apps.audit.models import AuditLog
from apps.core.choices import Action, FileType


@pytest.mark.django_db
def test_soft_delete_requires_account_admin():
    for role_factory in [lambda: UserFactory(role='student'), lambda: UserFactory(role='staff'),
                          SecurityFactory, ManagementFactory]:
        user = role_factory()
        report = ReportFactory()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(f'/api/v1/reports/{report.id}/delete/')
        assert response.status_code == 403, f"{user.role} got {response.status_code}"


@pytest.mark.django_db
def test_soft_delete_succeeds_for_ict_admin_and_system_admin():
    # System Admin sees every report unconditionally; ICT Admin's
    # visibility (Phase 14) is department-scoped, so they need to be this
    # report's department head to reach it at all.
    system_admin = SystemAdminFactory()
    report_for_system_admin = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.post(f'/api/v1/reports/{report_for_system_admin.id}/delete/')
    assert response.status_code == 200
    report_for_system_admin.refresh_from_db()
    assert report_for_system_admin.deleted_at is not None

    ict_admin = ICTAdminFactory()
    department = DepartmentFactory(head=ict_admin)
    report_for_ict_admin = ReportFactory(department=department)
    client.force_authenticate(user=ict_admin)
    response = client.post(f'/api/v1/reports/{report_for_ict_admin.id}/delete/')
    assert response.status_code == 200
    report_for_ict_admin.refresh_from_db()
    assert report_for_ict_admin.deleted_at is not None


@pytest.mark.django_db
def test_soft_delete_writes_audit_log():
    admin = ICTAdminFactory()
    department = DepartmentFactory(head=admin)
    report = ReportFactory(department=department)
    client = APIClient()
    client.force_authenticate(user=admin)
    client.post(f'/api/v1/reports/{report.id}/delete/')

    assert AuditLog.objects.filter(report=report, action=Action.SOFT_DELETE, actor=admin).exists()


@pytest.mark.django_db
def test_soft_deleted_report_excluded_from_accessible_reports_and_queue():
    admin = ICTAdminFactory()
    department = DepartmentFactory(head=admin)
    report = ReportFactory(department=department)

    assert report in get_accessible_reports(admin)

    client = APIClient()
    client.force_authenticate(user=admin)
    client.post(f'/api/v1/reports/{report.id}/delete/')

    assert report not in get_accessible_reports(admin)

    list_response = client.get('/api/v1/reports/')
    ids = [r['id'] for r in list_response.data['results']]
    assert str(report.id) not in ids


@pytest.mark.django_db
def test_soft_deleted_report_excluded_from_students_own_reports():
    student = UserFactory(role='student')
    report = ReportFactory()
    IdentityService.create_identity(report, student)

    system_admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=system_admin)
    client.post(f'/api/v1/reports/{report.id}/delete/')

    assert report not in get_accessible_reports(student)


@pytest.mark.django_db
def test_delete_is_idempotent_and_second_delete_404s():
    admin = ICTAdminFactory()
    department = DepartmentFactory(head=admin)
    report = ReportFactory(department=department)
    client = APIClient()
    client.force_authenticate(user=admin)

    first = client.post(f'/api/v1/reports/{report.id}/delete/')
    assert first.status_code == 200

    second = client.post(f'/api/v1/reports/{report.id}/delete/')
    assert second.status_code == 404


@pytest.mark.django_db
def test_restore_round_trip():
    admin = ICTAdminFactory()
    department = DepartmentFactory(head=admin)
    report = ReportFactory(department=department)
    client = APIClient()
    client.force_authenticate(user=admin)

    client.post(f'/api/v1/reports/{report.id}/delete/')
    report.refresh_from_db()
    assert report.deleted_at is not None

    restore_response = client.post(f'/api/v1/reports/{report.id}/restore/')
    assert restore_response.status_code == 200
    report.refresh_from_db()
    assert report.deleted_at is None
    assert AuditLog.objects.filter(report=report, action=Action.RESTORE, actor=admin).exists()

    assert report in get_accessible_reports(admin)


@pytest.mark.django_db
def test_restore_requires_account_admin():
    system_admin = SystemAdminFactory()
    report = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=system_admin)
    client.post(f'/api/v1/reports/{report.id}/delete/')

    security = SecurityFactory()
    client.force_authenticate(user=security)
    response = client.post(f'/api/v1/reports/{report.id}/restore/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_restore_404s_on_a_report_that_is_not_deleted():
    system_admin = SystemAdminFactory()
    report = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=system_admin)

    response = client.post(f'/api/v1/reports/{report.id}/restore/')
    assert response.status_code == 404


@pytest.mark.django_db
def test_deleted_list_view_shows_only_soft_deleted_reports():
    admin = ICTAdminFactory()
    department = DepartmentFactory(head=admin)
    deleted_report = ReportFactory(department=department)
    active_report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=admin)
    client.post(f'/api/v1/reports/{deleted_report.id}/delete/')

    response = client.get('/api/v1/reports/deleted/')
    assert response.status_code == 200
    ids = [r['id'] for r in response.data['results']]
    assert str(deleted_report.id) in ids
    assert str(active_report.id) not in ids


@pytest.mark.django_db
def test_deleted_list_view_requires_account_admin():
    security = SecurityFactory()
    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/reports/deleted/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_purge_deleted_reports_dry_run_does_not_delete(capsys):
    report = ReportFactory()
    report.deleted_at = timezone.now() - timedelta(days=200)
    report.save(update_fields=['deleted_at'])

    call_command('purge_deleted_reports', '--dry-run')

    assert Report.objects.filter(id=report.id).exists()
    captured = capsys.readouterr()
    assert 'dry-run' in captured.out


@pytest.mark.django_db
def test_purge_deleted_reports_respects_retention_window():
    recent = ReportFactory()
    recent.deleted_at = timezone.now() - timedelta(days=10)
    recent.save(update_fields=['deleted_at'])

    old = ReportFactory()
    old.deleted_at = timezone.now() - timedelta(days=200)
    old.save(update_fields=['deleted_at'])

    call_command('purge_deleted_reports', '--days', '90')

    assert Report.objects.filter(id=recent.id).exists()
    assert not Report.objects.filter(id=old.id).exists()


@pytest.mark.django_db
def test_purge_deleted_reports_cascades_evidence_and_identity():
    student = UserFactory(role='student')
    report = ReportFactory()
    identity = IdentityService.create_identity(report, student)
    evidence = Evidence.objects.create(report=report, file='evidence/test.jpg', file_type=FileType.IMAGE)

    report.deleted_at = timezone.now() - timedelta(days=200)
    report.save(update_fields=['deleted_at'])

    call_command('purge_deleted_reports', '--days', '90')

    assert not Report.objects.filter(id=report.id).exists()
    assert not ReportIdentity.objects.filter(id=identity.id).exists()
    assert not Evidence.objects.filter(id=evidence.id).exists()


@pytest.mark.django_db
def test_purge_deleted_reports_leaves_non_deleted_reports_alone():
    active = ReportFactory()
    call_command('purge_deleted_reports', '--days', '0')
    assert Report.objects.filter(id=active.id).exists()
