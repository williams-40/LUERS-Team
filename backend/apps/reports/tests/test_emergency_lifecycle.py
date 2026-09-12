import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, DepartmentFactory, DepartmentHeadFactory, EmergencyCategoryFactory
from apps.reports.models import Report, EmergencyDispatch
from apps.audit.models import AuditLog
from apps.core.choices import Action, Status


def _create_panic_report(client, student, emergency_type='security'):
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': emergency_type,
    })
    assert response.status_code == 201, response.data
    return Report.objects.get(id=response.data['id'])


@pytest.fixture
def security_department():
    department = DepartmentFactory(name='Security')
    EmergencyCategoryFactory(slug='security', department=department)
    return department


@pytest.mark.django_db
def test_unassigned_department_member_can_view_panic_report_detail(security_department):
    """A plain member (not head, not yet assigned) has no other reason to
    be in get_accessible_reports' visibility set, but must still be able
    to read the emergency before deciding whether to acknowledge it."""
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    response = member_client.get(f'/api/v1/reports/{report.id}/')
    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_unrelated_department_member_cannot_view_panic_report_detail(security_department):
    student = UserFactory(role='student')
    other_department = DepartmentFactory(name='Library')
    outsider = UserFactory(role='responder')
    other_department.members.add(outsider)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    outsider_client = APIClient()
    outsider_client.force_authenticate(user=outsider)
    response = outsider_client.get(f'/api/v1/reports/{report.id}/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_department_member_cannot_view_unassigned_normal_report_detail():
    """The panic-only widening must not leak into normal reports."""
    student = UserFactory(role='student')
    department = DepartmentFactory(name='Library')
    member = UserFactory(role='responder')
    department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'normal', 'department': str(department.id), 'description': 'A routine, non-urgent report',
    })
    assert response.status_code == 201

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    detail_response = member_client.get(f'/api/v1/reports/{response.data["id"]}/')
    assert detail_response.status_code == 403


@pytest.mark.django_db
def test_acknowledge_by_department_member_succeeds_and_auto_assigns(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    responder_client = APIClient()
    responder_client.force_authenticate(user=member)
    response = responder_client.post(f'/api/v1/reports/{report.id}/acknowledge/')

    assert response.status_code == 200, response.data
    report.refresh_from_db()
    assert report.status == Status.ACKNOWLEDGED
    assert report.assigned_to_id == member.id

    dispatch = EmergencyDispatch.objects.get(report=report)
    assert dispatch.acknowledged_at is not None
    assert dispatch.acknowledged_by_id == member.id
    assert AuditLog.objects.filter(report=report, action=Action.EMERGENCY_ACKNOWLEDGED).exists()


@pytest.mark.django_db
def test_acknowledge_twice_fails(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    responder_client = APIClient()
    responder_client.force_authenticate(user=member)
    first = responder_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    assert first.status_code == 200

    second = responder_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    assert second.status_code == 400


@pytest.mark.django_db
def test_acknowledge_requires_department_membership(security_department):
    student = UserFactory(role='student')
    outsider = UserFactory(role='responder')  # not a member of `security_department`

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    outsider_client = APIClient()
    outsider_client.force_authenticate(user=outsider)
    response = outsider_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_respond_requires_assigned_responder(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    other_member = UserFactory(role='responder')
    security_department.members.add(member, other_member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')  # member becomes assigned_to

    other_client = APIClient()
    other_client.force_authenticate(user=other_member)
    response = other_client.post(f'/api/v1/reports/{report.id}/respond/')
    # Same convention as every other head/assignee-only action in this
    # codebase (e.g. ReportAssignView, ReportStatusUpdateView): a user who
    # isn't the reporter, assigned responder, department head, or admin
    # doesn't pass get_accessible_reports at all, so it 404s rather than
    # 403s — not confirming the report's existence to an unrelated member.
    assert response.status_code == 404

    response = member_client.post(f'/api/v1/reports/{report.id}/respond/')
    assert response.status_code == 200
    report.refresh_from_db()
    assert report.status == Status.IN_PROGRESS


@pytest.mark.django_db
def test_respond_before_acknowledge_fails(security_department):
    """Directly assigning (bypassing acknowledge) then responding must be
    rejected by the panic-only transition table (NEW -> IN_PROGRESS isn't
    an allowed jump)."""
    student = UserFactory(role='student')
    head = DepartmentHeadFactory()
    security_department.head = head
    security_department.save(update_fields=['head'])
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    head_client = APIClient()
    head_client.force_authenticate(user=head)
    assign_response = head_client.post(f'/api/v1/reports/{report.id}/assign/', {'assigned_to': str(member.id)})
    assert assign_response.status_code == 200

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    response = member_client.post(f'/api/v1/reports/{report.id}/respond/')
    assert response.status_code == 400


@pytest.mark.django_db
def test_arrive_sets_timestamp(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    member_client.post(f'/api/v1/reports/{report.id}/respond/')
    response = member_client.post(f'/api/v1/reports/{report.id}/arrive/')

    assert response.status_code == 200, response.data
    dispatch = EmergencyDispatch.objects.get(report=report)
    assert dispatch.arrived_at is not None
    # arrival doesn't change status further — still in_progress
    report.refresh_from_db()
    assert report.status == Status.IN_PROGRESS


@pytest.mark.django_db
def test_cancel_by_reporter_before_dispatch_succeeds(security_department):
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    response = client.post(f'/api/v1/reports/{report.id}/cancel/', {'reason': 'false_alarm'})
    assert response.status_code == 200, response.data
    report.refresh_from_db()
    assert report.status == Status.FALSE_ALARM


@pytest.mark.django_db
def test_cancel_by_reporter_after_dispatch_in_progress_fails(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    member_client.post(f'/api/v1/reports/{report.id}/respond/')

    response = client.post(f'/api/v1/reports/{report.id}/cancel/', {'reason': 'cancelled'})
    assert response.status_code == 403


@pytest.mark.django_db
def test_cancel_by_head_at_any_stage_succeeds(security_department):
    student = UserFactory(role='student')
    head = DepartmentHeadFactory()
    security_department.head = head
    security_department.save(update_fields=['head'])
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    member_client.post(f'/api/v1/reports/{report.id}/respond/')

    head_client = APIClient()
    head_client.force_authenticate(user=head)
    response = head_client.post(f'/api/v1/reports/{report.id}/cancel/', {'reason': 'cancelled'})
    assert response.status_code == 200, response.data
    report.refresh_from_db()
    assert report.status == Status.CANCELLED


@pytest.mark.django_db
def test_escalate_requires_department_head_with_reason(security_department):
    student = UserFactory(role='student')
    head = DepartmentHeadFactory()
    security_department.head = head
    security_department.save(update_fields=['head'])
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    denied = member_client.post(f'/api/v1/reports/{report.id}/escalate/', {'reason': 'need help'})
    # Same convention as ReportAssignView: a non-head member doesn't pass
    # get_accessible_reports at all for this head-only action, so it 404s.
    assert denied.status_code == 404

    head_client = APIClient()
    head_client.force_authenticate(user=head)
    missing_reason = head_client.post(f'/api/v1/reports/{report.id}/escalate/')
    assert missing_reason.status_code == 400

    response = head_client.post(f'/api/v1/reports/{report.id}/escalate/', {'reason': 'need admin eyes on this'})
    assert response.status_code == 200, response.data
    dispatch = EmergencyDispatch.objects.get(report=report)
    assert dispatch.escalation_level == 1
    entry = AuditLog.objects.get(report=report, action=Action.EMERGENCY_ESCALATED)
    assert entry.after_state['reason'] == 'need admin eyes on this'


@pytest.mark.django_db
def test_escalate_rejects_system_admin(security_department):
    """System Admin is the top of the chain and has nowhere to escalate to — only the department head gets this action."""
    student = UserFactory(role='student')
    head = DepartmentHeadFactory()
    security_department.head = head
    security_department.save(update_fields=['head'])
    admin = UserFactory(role='system_admin')

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    response = admin_client.post(f'/api/v1/reports/{report.id}/escalate/', {'reason': 'anything'})
    assert response.status_code == 403


@pytest.mark.django_db
def test_resolve_sets_emergency_dispatch_resolved_at(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    member_client.post(f'/api/v1/reports/{report.id}/respond/')
    member_client.post(f'/api/v1/reports/{report.id}/arrive/')

    response = member_client.patch(f'/api/v1/reports/{report.id}/status/', {'status': 'resolved'})
    assert response.status_code == 200, response.data

    dispatch = EmergencyDispatch.objects.get(report=report)
    assert dispatch.resolved_at is not None
    report.refresh_from_db()
    assert report.status == Status.RESOLVED


@pytest.mark.django_db
def test_full_emergency_lifecycle_happy_path(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)

    client = APIClient()
    client.force_authenticate(user=student)
    report = _create_panic_report(client, student)
    assert report.status == Status.NEW

    member_client = APIClient()
    member_client.force_authenticate(user=member)

    assert member_client.post(f'/api/v1/reports/{report.id}/acknowledge/').status_code == 200
    assert member_client.post(f'/api/v1/reports/{report.id}/respond/').status_code == 200
    assert member_client.post(f'/api/v1/reports/{report.id}/arrive/').status_code == 200
    assert member_client.patch(f'/api/v1/reports/{report.id}/status/', {'status': 'resolved'}).status_code == 200

    report.refresh_from_db()
    assert report.status == Status.RESOLVED
    dispatch = EmergencyDispatch.objects.get(report=report)
    assert dispatch.acknowledged_at is not None
    assert dispatch.responding_at is not None
    assert dispatch.arrived_at is not None
    assert dispatch.resolved_at is not None

    timeline_actions = set(
        AuditLog.objects.filter(report=report).values_list('action', flat=True)
    )
    assert {
        Action.CREATE, Action.EMERGENCY_ACKNOWLEDGED, Action.EMERGENCY_RESPONDING,
        Action.EMERGENCY_ARRIVED, Action.STATUS_UPDATE,
    }.issubset(timeline_actions)
