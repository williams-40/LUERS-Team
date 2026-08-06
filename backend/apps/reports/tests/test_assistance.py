import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.audit.models import AuditLog
from apps.core.choices import Action
from apps.notifications.models import Notification
from apps.reports.models import AssistanceRequest


@pytest.mark.django_db
def test_assigned_responder_can_request_assistance():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder)
    other_department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(other_department.id)], 'reason': 'Need medical backup',
    })

    assert response.status_code == 201
    entry = AuditLog.objects.get(report=report, action=Action.REQUEST_ASSISTANCE)
    assert entry.actor_id == responder.id
    assert entry.after_state['reason'] == 'Need medical backup'
    assert other_department.name in entry.after_state['departments']


@pytest.mark.django_db
def test_department_head_and_system_admin_can_request_assistance():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department)
    other_department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(other_department.id)], 'reason': 'Head-initiated request',
    })
    assert response.status_code == 201

    system_admin = SystemAdminFactory()
    client.force_authenticate(user=system_admin)
    response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(other_department.id)], 'reason': 'Admin-initiated request',
    })
    assert response.status_code == 201


@pytest.mark.django_db
def test_unrelated_member_cannot_request_assistance():
    """
    A plain member of the report's own department who isn't assigned to it
    has no access to the report at all via get_accessible_reports (that
    branch is scoped to assigned_to=user) — so this 404s before the
    can_request_assistance authority check even runs, matching the
    existing test_head_of_another_department_cannot_reach_report pattern.
    """
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    department.members.add(member)
    other_member = UserFactory(role='staff')
    department.members.add(other_member)
    report = ReportFactory(department=department, assigned_to=other_member)
    other_department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(other_department.id)], 'reason': 'Trying anyway',
    })
    assert response.status_code == 404


@pytest.mark.django_db
def test_reason_is_required():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder)
    other_department = DepartmentFactory()

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(other_department.id)],
    })
    assert response.status_code == 400


@pytest.mark.django_db
def test_assisting_department_member_gains_visibility_uninvolved_department_does_not():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder)

    assisting_department = DepartmentFactory()
    assisting_member = UserFactory(role='staff')
    assisting_department.members.add(assisting_member)

    uninvolved_department = DepartmentFactory()
    uninvolved_member = UserFactory(role='staff')
    uninvolved_department.members.add(uninvolved_member)

    client = APIClient()
    client.force_authenticate(user=responder)
    client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(assisting_department.id)], 'reason': 'Need backup',
    })

    client.force_authenticate(user=assisting_member)
    response = client.get(f'/api/v1/reports/{report.id}/')
    assert response.status_code == 200

    client.force_authenticate(user=uninvolved_member)
    response = client.get(f'/api/v1/reports/{report.id}/')
    # ReportDetailView's queryset is unfiltered Report.objects.all() at the
    # generic-view level, so get_object() finds the row and the explicit
    # accessible-check raises PermissionDenied (403), not a 404 — unlike
    # the get_object_or_404(get_accessible_reports(...)) views elsewhere.
    assert response.status_code == 403


@pytest.mark.django_db
def test_acknowledge_records_and_notifies_requester():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder)

    assisting_department = DepartmentFactory()
    assisting_member = UserFactory(role='staff')
    assisting_department.members.add(assisting_member)

    client = APIClient()
    client.force_authenticate(user=responder)
    create_response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(assisting_department.id)], 'reason': 'Need backup',
    })
    assistance_request_id = create_response.data['id']

    client.force_authenticate(user=assisting_member)
    response = client.post(f'/api/v1/reports/assistance-requests/{assistance_request_id}/acknowledge/', {
        'department_id': str(assisting_department.id),
    })

    assert response.status_code == 200
    assert AuditLog.objects.filter(report=report, action=Action.ACKNOWLEDGE_ASSISTANCE).exists()
    assert Notification.objects.filter(recipient=responder, report=report).exists()


@pytest.mark.django_db
def test_acknowledge_rejects_non_member_and_uninvolved_department():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder)

    assisting_department = DepartmentFactory()
    assisting_member = UserFactory(role='staff')
    assisting_department.members.add(assisting_member)
    outsider = UserFactory(role='staff')

    client = APIClient()
    client.force_authenticate(user=responder)
    create_response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(assisting_department.id)], 'reason': 'Need backup',
    })
    assistance_request_id = create_response.data['id']

    client.force_authenticate(user=outsider)
    response = client.post(f'/api/v1/reports/assistance-requests/{assistance_request_id}/acknowledge/', {
        'department_id': str(assisting_department.id),
    })
    # The outsider has zero access to the underlying report at all (not a
    # member of any involved department), so the assistance request lookup
    # itself 404s — mirrors AssistanceRequestAcknowledgeView's
    # get_object_or_404(..., get_accessible_reports(...)) pattern.
    assert response.status_code == 404

    uninvolved_department = DepartmentFactory()
    client.force_authenticate(user=assisting_member)
    response = client.post(f'/api/v1/reports/assistance-requests/{assistance_request_id}/acknowledge/', {
        'department_id': str(uninvolved_department.id),
    })
    assert response.status_code == 403


@pytest.mark.django_db
def test_acknowledge_is_idempotent_per_department():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder)

    assisting_department = DepartmentFactory()
    member_one = UserFactory(role='staff')
    member_two = UserFactory(role='staff')
    assisting_department.members.add(member_one, member_two)

    client = APIClient()
    client.force_authenticate(user=responder)
    create_response = client.post(f'/api/v1/reports/{report.id}/request-assistance/', {
        'departments': [str(assisting_department.id)], 'reason': 'Need backup',
    })
    assistance_request_id = create_response.data['id']

    client.force_authenticate(user=member_one)
    client.post(f'/api/v1/reports/assistance-requests/{assistance_request_id}/acknowledge/', {
        'department_id': str(assisting_department.id),
    })
    client.force_authenticate(user=member_two)
    client.post(f'/api/v1/reports/assistance-requests/{assistance_request_id}/acknowledge/', {
        'department_id': str(assisting_department.id),
    })

    assistance_request = AssistanceRequest.objects.get(id=assistance_request_id)
    assert assistance_request.acknowledgements.count() == 1
    assert assistance_request.acknowledgements.first().acknowledged_by_id == member_one.id
    assert AuditLog.objects.filter(report=report, action=Action.ACKNOWLEDGE_ASSISTANCE).count() == 1
