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
def test_responder_sees_assigned_report_even_without_current_department_membership():
    """
    Phase 5: get_accessible_reports simplified to the redesign's exact
    four-rule model (reporter OR assigned_to OR department head OR
    System Admin) — assigned_to alone is now sufficient, with no
    separate "and is currently a department member" check. In real
    usage assignment is already gated to a department member/head at
    assignment time (ReportAssignView/is_department_member_or_head), so
    this never grants anything the old stricter rule wouldn't also have
    granted at assignment time — it only stops *retroactively* removing
    access if someone is later taken off the department after already
    being assigned a report.
    """
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    report = ReportFactory(department=department, assigned_to=responder)
    # Deliberately not added to department.members — proves assigned_to
    # alone is now sufficient.

    assert report in get_accessible_reports(responder)


@pytest.mark.django_db
def test_department_head_and_member_still_see_their_own_filed_reports():
    """
    Regression test (Phase 16): a department head/member is also a
    potential reporter, and must see reports they personally filed even
    though those reports aren't assigned to them or in a department they
    head/belong to. Previously this fell through to the function's final
    `else` branch, which only ever ran for a user with *zero* department
    affiliation — so it silently broke for every head/member the moment
    they filed a report unrelated to their own department (found live
    while verifying the Phase 16 feedback flow, once every seeded user had
    a department membership from Phase 15's population pass).
    """
    head = SecurityFactory()
    DepartmentFactory(head=head)  # unrelated department the head heads
    head_own_report = ReportFactory(department=DepartmentFactory(), reporter=head)

    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    member_own_report = ReportFactory(department=DepartmentFactory(), reporter=member)

    assert head_own_report in get_accessible_reports(head)
    assert member_own_report in get_accessible_reports(member)


@pytest.mark.django_db
def test_user_with_no_department_and_not_system_admin_sees_only_own_reports():
    reporter = UserFactory(role='student')
    own_report = ReportFactory(reporter=reporter)
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


@pytest.mark.django_db
def test_get_accessible_audit_logs_head_sees_own_report_independent_actions():
    """
    Phase 6: a department head's report-independent actions (e.g.
    creating a responder account) produce an AuditLog entry with
    report=None. The head branch used to filter purely by
    report__in=<their department's reports>, which would silently hide
    their own such entries from themselves — fixed by also including
    Q(actor=user) unconditionally for heads, mirroring the member
    branch's existing "always see your own actions" rule.
    """
    head = SecurityFactory()
    DepartmentFactory(head=head)
    entry = AuditLog.objects.create(
        report=None, actor=head, action=Action.RESPONDER_CREATED, after_state={},
    )
    assert entry in get_accessible_audit_logs(head)
