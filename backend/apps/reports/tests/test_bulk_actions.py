import pytest
from rest_framework.test import APIClient
from apps.core.factories import (
    UserFactory, SecurityFactory, ICTAdminFactory, ManagementFactory, ReportFactory, DepartmentFactory,
)
from apps.audit.models import AuditLog
from apps.core.choices import Status, Action


@pytest.mark.django_db
def test_bulk_status_update_rejects_inaccessible_reports_per_item():
    """
    Phase 14: the endpoint itself is IsAuthenticated (not IsSecurity-only)
    — real authorization is per-report via get_accessible_reports. A user
    with no relationship to the report gets 200 with a per-item "not
    found" error, not a blanket 403.
    """
    for role_factory in [lambda: UserFactory(role='student'), lambda: UserFactory(role='staff'),
                          ICTAdminFactory, ManagementFactory]:
        user = role_factory()
        report = ReportFactory()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post('/api/v1/reports/bulk/status/', {
            'report_ids': [str(report.id)], 'status': Status.ACKNOWLEDGED,
        }, format='json')
        assert response.status_code == 200, f"{user.role} got {response.status_code}"
        assert response.data['results'][0]['status'] == 'error'


@pytest.mark.django_db
def test_bulk_status_update_rejects_own_report_for_reporter():
    """Phase 5: mirrors the single-report ReportStatusUpdateView fix — the report's own reporter can see it (get_accessible_reports) but must not be able to update its status themselves."""
    reporter = UserFactory(role='student')
    report = ReportFactory(reporter=reporter, status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=reporter)
    response = client.post('/api/v1/reports/bulk/status/', {
        'report_ids': [str(report.id)], 'status': Status.ACKNOWLEDGED,
    }, format='json')

    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'error'
    report.refresh_from_db()
    assert report.status == Status.NEW


@pytest.mark.django_db
def test_bulk_status_update_rejects_department_head_who_isnt_assigned():
    """2026-08-17: mirrors the single-report ReportStatusUpdateView tightening — a department head can see every report in their department but no longer updates status on any of them, assigned or not."""
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department, status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post('/api/v1/reports/bulk/status/', {
        'report_ids': [str(report.id)], 'status': Status.ACKNOWLEDGED,
    }, format='json')

    assert response.status_code == 200
    assert response.data['results'][0]['status'] == 'error'
    report.refresh_from_db()
    assert report.status == Status.NEW


@pytest.mark.django_db
def test_bulk_status_update_all_succeed():
    security = SecurityFactory()
    department = DepartmentFactory()
    department.members.add(security)
    reports = [ReportFactory(department=department, status=Status.NEW, assigned_to=security) for _ in range(3)]

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post('/api/v1/reports/bulk/status/', {
        'report_ids': [str(r.id) for r in reports], 'status': Status.ACKNOWLEDGED,
    }, format='json')

    assert response.status_code == 200
    results = response.data['results']
    assert len(results) == 3
    assert all(r['status'] == 'success' for r in results)
    for r in reports:
        r.refresh_from_db()
        assert r.status == Status.ACKNOWLEDGED


@pytest.mark.django_db
def test_bulk_status_update_partial_failure():
    security = SecurityFactory()
    department = DepartmentFactory()
    department.members.add(security)
    already_there = ReportFactory(department=department, status=Status.ACKNOWLEDGED, assigned_to=security)
    needs_update = ReportFactory(department=department, status=Status.NEW, assigned_to=security)

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post('/api/v1/reports/bulk/status/', {
        'report_ids': [str(already_there.id), str(needs_update.id)], 'status': Status.ACKNOWLEDGED,
    }, format='json')

    assert response.status_code == 200
    results = {r['report_id']: r for r in response.data['results']}
    assert results[str(already_there.id)]['status'] == 'error'
    assert 'already set' in results[str(already_there.id)]['error']
    assert results[str(needs_update.id)]['status'] == 'success'


@pytest.mark.django_db
def test_bulk_status_update_skips_inaccessible_report():
    security = SecurityFactory()
    fake_id = '11111111-2222-3333-4444-555555555555'

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post('/api/v1/reports/bulk/status/', {
        'report_ids': [fake_id], 'status': Status.ACKNOWLEDGED,
    }, format='json')

    assert response.status_code == 200
    result = response.data['results'][0]
    assert result['status'] == 'error'
    assert 'not found' in result['error'].lower()


@pytest.mark.django_db
def test_bulk_status_update_creates_audit_log_per_report():
    security = SecurityFactory()
    department = DepartmentFactory()
    department.members.add(security)
    reports = [ReportFactory(department=department, status=Status.NEW, assigned_to=security) for _ in range(2)]

    client = APIClient()
    client.force_authenticate(user=security)
    client.post('/api/v1/reports/bulk/status/', {
        'report_ids': [str(r.id) for r in reports], 'status': Status.ACKNOWLEDGED,
    }, format='json')

    for r in reports:
        assert AuditLog.objects.filter(report=r, action=Action.STATUS_UPDATE).count() == 1


@pytest.mark.django_db
def test_bulk_status_update_enforces_max_report_ids():
    security = SecurityFactory()
    fake_ids = [f'11111111-2222-3333-4444-{i:012d}' for i in range(101)]

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post('/api/v1/reports/bulk/status/', {
        'report_ids': fake_ids, 'status': Status.ACKNOWLEDGED,
    }, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_assign_rejects_non_head_non_system_admin_per_item():
    """
    Assignment authority is now "this report's department head, or System
    Admin" — not a fixed Security/ICT Admin role gate. A user with no
    such standing gets 200 with a per-item error, not a blanket 403.
    """
    department = DepartmentFactory()
    officer = SecurityFactory()
    department.members.add(officer)

    for role_factory in [lambda: UserFactory(role='student'), ManagementFactory]:
        user = role_factory()
        report = ReportFactory(department=department)
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post('/api/v1/reports/bulk/assign/', {
            'report_ids': [str(report.id)], 'assigned_to': str(officer.id),
        }, format='json')
        assert response.status_code == 200, f"{user.role} got {response.status_code}"
        assert response.data['results'][0]['status'] == 'error'


@pytest.mark.django_db
def test_bulk_assign_all_succeed():
    ict_admin = ICTAdminFactory()
    department = DepartmentFactory(head=ict_admin)
    officer = SecurityFactory()
    department.members.add(officer)
    reports = [ReportFactory(department=department) for _ in range(3)]

    client = APIClient()
    client.force_authenticate(user=ict_admin)
    response = client.post('/api/v1/reports/bulk/assign/', {
        'report_ids': [str(r.id) for r in reports], 'assigned_to': str(officer.id),
    }, format='json')

    assert response.status_code == 200
    assert all(r['status'] == 'success' for r in response.data['results'])
    for r in reports:
        r.refresh_from_db()
        assert r.assigned_to_id == officer.id


@pytest.mark.django_db
def test_bulk_assign_rejects_assignee_outside_department():
    """assigned_to must be a member (or head) of the report's own department — role is irrelevant now."""
    department = DepartmentFactory()
    head = department.head or SecurityFactory()
    department.head = head
    department.save()
    outsider = UserFactory(role='staff')  # not a member of `department`
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post('/api/v1/reports/bulk/assign/', {
        'report_ids': [str(report.id)], 'assigned_to': str(outsider.id),
    }, format='json')

    assert response.status_code == 200
    result = response.data['results'][0]
    assert result['status'] == 'error'
    assert 'department' in result['error'].lower()


@pytest.mark.django_db
def test_bulk_assign_partial_failure_inaccessible_report():
    department = DepartmentFactory()
    head = SecurityFactory()
    department.head = head
    department.save()
    officer = SecurityFactory()
    department.members.add(officer)
    real_report = ReportFactory(department=department)
    fake_id = '11111111-2222-3333-4444-555555555555'

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post('/api/v1/reports/bulk/assign/', {
        'report_ids': [str(real_report.id), fake_id], 'assigned_to': str(officer.id),
    }, format='json')

    assert response.status_code == 200
    results = {r['report_id']: r for r in response.data['results']}
    assert results[str(real_report.id)]['status'] == 'success'
    assert results[fake_id]['status'] == 'error'
