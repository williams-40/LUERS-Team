import pytest
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
def test_assignable_officers_rejects_non_head():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department, assigned_to=member)

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.get(f'/api/v1/reports/{report.id}/assignable-officers/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_department_head_can_transfer_report():
    head = SecurityFactory()
    origin = DepartmentFactory(head=head)
    dest_head = SecurityFactory()
    destination = DepartmentFactory(head=dest_head)
    report = ReportFactory(department=origin, assigned_to=head)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post(f'/api/v1/reports/{report.id}/transfer/', {
        'department_id': str(destination.id), 'reason': 'Actually an ICT issue',
    })

    assert response.status_code == 200
    report.refresh_from_db()
    assert report.department_id == destination.id
    assert report.assigned_to is None  # cleared on transfer

    entry = AuditLog.objects.get(report=report, action=Action.DEPARTMENT_TRANSFER)
    assert entry.before_state['department'] == origin.name
    assert entry.after_state['department'] == destination.name
    assert entry.after_state['reason'] == 'Actually an ICT issue'

    from apps.notifications.models import Notification
    assert Notification.objects.filter(recipient=dest_head, report=report).exists()


@pytest.mark.django_db
def test_transfer_rejected_for_non_head_non_system_admin():
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department, assigned_to=member)
    destination = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.post(f'/api/v1/reports/{report.id}/transfer/', {'department_id': str(destination.id)})

    assert response.status_code == 403


@pytest.mark.django_db
def test_system_admin_can_transfer_any_report():
    system_admin = SystemAdminFactory()
    department = DepartmentFactory()
    destination = DepartmentFactory()
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.post(f'/api/v1/reports/{report.id}/transfer/', {'department_id': str(destination.id)})

    assert response.status_code == 200


@pytest.mark.django_db
def test_department_head_can_escalate():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    system_admin = SystemAdminFactory()
    report = ReportFactory(department=department)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post(f'/api/v1/reports/{report.id}/escalate/', {'reason': 'Needs admin review'})

    assert response.status_code == 200
    entry = AuditLog.objects.get(report=report, action=Action.ESCALATE)
    assert entry.actor_id == head.id
    assert entry.after_state['reason'] == 'Needs admin review'

    from apps.notifications.models import Notification
    assert Notification.objects.filter(recipient=system_admin, report=report).exists()


@pytest.mark.django_db
def test_escalate_rejected_for_system_admin_and_members():
    """Escalating to System Admin only makes sense for the department head — not System Admin themselves, not a plain member."""
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    report = ReportFactory(department=department, assigned_to=member)

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.post(f'/api/v1/reports/{report.id}/escalate/')
    assert response.status_code == 403

    system_admin = SystemAdminFactory()
    client.force_authenticate(user=system_admin)
    response = client.post(f'/api/v1/reports/{report.id}/escalate/')
    assert response.status_code == 403
