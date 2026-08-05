import pytest
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.reports.services import get_accessible_reports, get_accessible_audit_logs, ReportService
from apps.core.choices import Status, Action
from apps.audit.models import AuditLog


@pytest.mark.django_db
def test_system_admin_sees_every_report():
    system_admin = SystemAdminFactory()
    a = ReportFactory()
    b = ReportFactory(department=DepartmentFactory())
    accessible = get_accessible_reports(system_admin)
    assert a in accessible
    assert b in accessible


@pytest.mark.django_db
def test_department_head_sees_every_report_in_their_department_not_others():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    other_department = DepartmentFactory()
    own_report = ReportFactory(department=department)
    unassigned_own_report = ReportFactory(department=department)  # head sees this too, not just assigned ones
    other_report = ReportFactory(department=other_department)

    accessible = get_accessible_reports(head)
    assert own_report in accessible
    assert unassigned_own_report in accessible
    assert other_report not in accessible


@pytest.mark.django_db
def test_department_member_sees_only_reports_assigned_to_them():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    assigned_to_member = ReportFactory(department=department, assigned_to=member)
    unassigned_in_same_department = ReportFactory(department=department)
    assigned_to_someone_else = ReportFactory(department=department, assigned_to=SecurityFactory())

    accessible = get_accessible_reports(member)
    assert assigned_to_member in accessible
    assert unassigned_in_same_department not in accessible
    assert assigned_to_someone_else not in accessible


@pytest.mark.django_db
def test_user_with_no_department_and_not_system_admin_sees_only_own_reports():
    from apps.reports.services import IdentityService
    reporter = UserFactory(role='student')
    own_report = ReportFactory(is_anonymous=False)
    IdentityService.create_identity(own_report, reporter)
    other_report = ReportFactory()

    accessible = get_accessible_reports(reporter)
    assert own_report in accessible
    assert other_report not in accessible


@pytest.mark.django_db
def test_ict_admin_with_no_department_sees_nothing():
    """
    Phase 14: report visibility is department-based, not role-based —
    an ict_admin account with no department head/member relationship at
    all sees nothing (not even the identity-based reporter fallback,
    which only makes sense for actual reporters).
    """
    ict_admin = UserFactory(role='ict_admin')
    ReportFactory()
    assert get_accessible_reports(ict_admin).count() == 0


@pytest.mark.django_db
def test_get_accessible_audit_logs_system_admin_sees_all():
    system_admin = SystemAdminFactory()
    report = ReportFactory()
    ReportService.update_status(report, Status.ACKNOWLEDGED, SecurityFactory(), ip_address='127.0.0.1')
    assert get_accessible_audit_logs(system_admin).filter(report=report).exists()


@pytest.mark.django_db
def test_get_accessible_audit_logs_head_sees_all_department_entries_not_just_own():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department)
    # Member acts on the report, not the head.
    ReportService.update_status(report, Status.ACKNOWLEDGED, member, ip_address='127.0.0.1')

    logs = get_accessible_audit_logs(head)
    assert logs.filter(report=report, action=Action.STATUS_UPDATE, actor=member).exists()


@pytest.mark.django_db
def test_get_accessible_audit_logs_member_sees_only_own_actions():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    other_member = UserFactory(role='staff')
    department.members.add(member, other_member)
    report = ReportFactory(department=department)

    ReportService.update_status(report, Status.ACKNOWLEDGED, member, ip_address='127.0.0.1')
    report2 = ReportFactory(department=department, status=Status.NEW)
    ReportService.update_status(report2, Status.ACKNOWLEDGED, other_member, ip_address='127.0.0.1')

    logs = get_accessible_audit_logs(member)
    assert logs.filter(actor=member).exists()
    assert not logs.filter(actor=other_member).exists()


@pytest.mark.django_db
def test_get_accessible_audit_logs_unaffiliated_user_sees_nothing():
    user = UserFactory(role='ict_admin')
    report = ReportFactory()
    AuditLog.objects.create(report=report, actor=user, action=Action.CREATE, after_state={})
    assert get_accessible_audit_logs(user).count() == 0
