import pytest
from datetime import timedelta
from django.utils import timezone
from apps.core.factories import UserFactory, DepartmentFactory, EmergencyCategoryFactory
from apps.reports.models import Report, EmergencyDispatch
from apps.reports.tasks import check_emergency_escalations
from apps.reports.services import EmergencyDispatchService
from apps.audit.models import AuditLog
from apps.core.choices import Action, Status


def _create_panic_report(student, department):
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {'urgency': 'panic', 'emergency_type': 'security'})
    assert response.status_code == 201, response.data
    return Report.objects.get(id=response.data['id'])


@pytest.fixture
def security_department():
    department = DepartmentFactory(name='Security')
    EmergencyCategoryFactory(slug='security', department=department)
    return department


@pytest.mark.django_db
def test_escalation_task_escalates_report_past_ack_deadline(security_department):
    student = UserFactory(role='student')
    report = _create_panic_report(student, security_department)
    EmergencyDispatch.objects.filter(report=report).update(ack_deadline=timezone.now() - timedelta(minutes=1))

    result = check_emergency_escalations()

    assert str(report.id) in result['escalated']
    dispatch = EmergencyDispatch.objects.get(report=report)
    assert dispatch.escalation_level == 1
    assert dispatch.last_escalated_at is not None
    entry = AuditLog.objects.get(report=report, action=Action.EMERGENCY_ESCALATED)
    assert entry.actor is None  # automatic escalation


@pytest.mark.django_db
def test_escalation_task_ignores_report_within_deadline(security_department):
    student = UserFactory(role='student')
    report = _create_panic_report(student, security_department)
    EmergencyDispatch.objects.filter(report=report).update(ack_deadline=timezone.now() + timedelta(minutes=30))

    result = check_emergency_escalations()

    assert str(report.id) not in result['escalated']
    assert EmergencyDispatch.objects.get(report=report).escalation_level == 0


@pytest.mark.django_db
def test_escalation_task_ignores_resolved_reports(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)
    report = _create_panic_report(student, security_department)

    from rest_framework.test import APIClient
    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    member_client.post(f'/api/v1/reports/{report.id}/respond/')
    member_client.patch(f'/api/v1/reports/{report.id}/status/', {'status': 'resolved'})

    EmergencyDispatch.objects.filter(report=report).update(
        ack_deadline=timezone.now() - timedelta(hours=1),
        response_deadline=timezone.now() - timedelta(hours=1),
        resolution_deadline=timezone.now() - timedelta(hours=1),
    )

    result = check_emergency_escalations()
    assert str(report.id) not in result['escalated']


@pytest.mark.django_db
def test_escalation_task_does_not_double_escalate_same_deadline(security_department):
    student = UserFactory(role='student')
    report = _create_panic_report(student, security_department)
    EmergencyDispatch.objects.filter(report=report).update(ack_deadline=timezone.now() - timedelta(minutes=1))

    first = check_emergency_escalations()
    second = check_emergency_escalations()

    assert str(report.id) in first['escalated']
    assert str(report.id) not in second['escalated']
    assert EmergencyDispatch.objects.get(report=report).escalation_level == 1


@pytest.mark.django_db
def test_escalation_task_escalates_again_after_a_later_deadline_is_also_missed(security_department):
    student = UserFactory(role='student')
    member = UserFactory(role='responder')
    security_department.members.add(member)
    report = _create_panic_report(student, security_department)

    # Miss the ack deadline first.
    EmergencyDispatch.objects.filter(report=report).update(ack_deadline=timezone.now() - timedelta(minutes=10))
    check_emergency_escalations()
    assert EmergencyDispatch.objects.get(report=report).escalation_level == 1

    # Now acknowledge (clears the ack-deadline branch) but also miss the
    # response deadline — a second, independent escalation. Backdate
    # last_escalated_at to simulate real elapsed time since the first
    # escalation (both events happen within the same test-clock instant
    # otherwise, which would make the new deadline look "already covered").
    from rest_framework.test import APIClient
    member_client = APIClient()
    member_client.force_authenticate(user=member)
    member_client.post(f'/api/v1/reports/{report.id}/acknowledge/')
    EmergencyDispatch.objects.filter(report=report).update(
        last_escalated_at=timezone.now() - timedelta(hours=1),
        response_deadline=timezone.now() - timedelta(minutes=1),
    )

    check_emergency_escalations()
    assert EmergencyDispatch.objects.get(report=report).escalation_level == 2


@pytest.mark.django_db
def test_manual_escalate_service_rejects_inactive_report(security_department):
    student = UserFactory(role='student')
    report = _create_panic_report(student, security_department)
    report.status = Status.RESOLVED
    report.save(update_fields=['status'])

    with pytest.raises(Exception):
        EmergencyDispatchService.escalate(report, actor=None)
