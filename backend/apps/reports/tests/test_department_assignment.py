import pytest
from django.core import mail
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.audit.models import AuditLog
from apps.core.choices import Action


@pytest.mark.django_db
def test_department_head_can_assign_within_own_department():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(member.id)})

    assert response.status_code == 200
    report.refresh_from_db()
    assert report.assigned_to_id == member.id
    assert AuditLog.objects.filter(report=report, action=Action.ASSIGN, actor=head).exists()


@pytest.mark.django_db
def test_assignment_sends_an_assignment_specific_email():
    """
    Requirement (2026-08-17): the assigned responder gets emailed, with
    copy distinct from the generic report-creation email reused verbatim
    here until now — assert on the new copy, not just "an email fired".
    """
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(member.id)})

    assert response.status_code == 200
    assignment_emails = [m for m in mail.outbox if m.to == [member.email]]
    assert len(assignment_emails) == 1
    assert "you've been assigned" in assignment_emails[0].subject.lower()
    assert 'a new report has been submitted' not in assignment_emails[0].body.lower()


@pytest.mark.django_db
def test_system_admin_can_assign_in_any_department():
    system_admin = SystemAdminFactory()
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(member.id)})

    assert response.status_code == 200


@pytest.mark.django_db
def test_plain_member_cannot_assign():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    other_member = UserFactory(role='staff')
    department.members.add(other_member)
    report = ReportFactory(department=department, assigned_to=member)

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(other_member.id)})

    assert response.status_code == 403


@pytest.mark.django_db
def test_head_of_another_department_cannot_reach_report():
    department = DepartmentFactory()
    report = ReportFactory(department=department)
    other_head = SecurityFactory()
    DepartmentFactory(head=other_head)

    client = APIClient()
    client.force_authenticate(user=other_head)
    response = client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(other_head.id)})

    # other_head has no access to this report at all (not their department),
    # so get_accessible_reports() 404s it before the authority check even runs.
    assert response.status_code == 404


@pytest.mark.django_db
def test_assign_rejects_user_outside_report_department():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department)
    outsider = UserFactory(role='staff')  # not a member of `department`

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(outsider.id)})

    assert response.status_code == 400
    assert 'assigned_to' in response.data


@pytest.mark.django_db
def test_assignable_officers_returns_head_and_members():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.get(f'/api/v1/reports/{report.id}/assignable-officers/')

    assert response.status_code == 200
    ids = {o['id'] for o in response.data}
    assert str(head.id) in ids
    assert str(member.id) in ids


@pytest.mark.django_db
def test_assignable_officers_includes_open_report_count():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    busy_member = UserFactory(role='staff')
    free_member = UserFactory(role='staff')
    department.members.add(busy_member, free_member)
    # two open reports for busy_member, one resolved (shouldn't count)
    ReportFactory(department=department, assigned_to=busy_member, status='new')
    ReportFactory(department=department, assigned_to=busy_member, status='in_progress')
    ReportFactory(department=department, assigned_to=busy_member, status='resolved')
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.get(f'/api/v1/reports/{report.id}/assignable-officers/')

    assert response.status_code == 200
    by_id = {o['id']: o for o in response.data}
    assert by_id[str(busy_member.id)]['open_report_count'] == 2
    assert by_id[str(free_member.id)]['open_report_count'] == 0


@pytest.mark.django_db
def test_assignable_officers_rejects_non_head():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department, assigned_to=member)

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.get(f'/api/v1/reports/{report.id}/assignable-officers/')

    assert response.status_code == 403
