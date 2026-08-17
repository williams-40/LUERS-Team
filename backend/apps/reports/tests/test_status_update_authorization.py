import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.core.choices import Status


@pytest.mark.django_db
def test_reporter_cannot_update_their_own_report_status():
    """
    Phase 5: closes a real gap — ReportStatusUpdateView was previously
    gated only by get_accessible_reports ("can view"), which includes
    the report's own reporter. The frontend never exposed this control
    to a plain reporter (ReportDetailPage's canUpdateStatus requires
    being the assigned responder or department head/admin), but the
    backend accepted it from a direct API call. Now gated the same way
    the frontend already assumed.
    """
    reporter = UserFactory(role='student')
    report = ReportFactory(reporter=reporter, status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=reporter)
    response = client.patch(f'/api/v1/reports/{report.id}/status/', {'status': Status.ACKNOWLEDGED})

    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == Status.NEW


@pytest.mark.django_db
def test_assigned_responder_can_update_status():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    report = ReportFactory(department=department, assigned_to=responder, status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.patch(f'/api/v1/reports/{report.id}/status/', {'status': Status.ACKNOWLEDGED})

    assert response.status_code == 200
    report.refresh_from_db()
    assert report.status == Status.ACKNOWLEDGED


@pytest.mark.django_db
def test_department_head_cannot_update_status_even_of_own_departments_report():
    """
    2026-08-17: heads assign and monitor, they don't do fieldwork — status
    updates are exclusively the assigned responder's job now, even for a
    report in a department this head runs (they can still see it, via
    get_accessible_reports, just can't change its status).
    """
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department, status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.patch(f'/api/v1/reports/{report.id}/status/', {'status': Status.ACKNOWLEDGED})

    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == Status.NEW


@pytest.mark.django_db
def test_system_admin_cannot_update_status():
    """
    2026-08-17: closes the same backend-only gap already closed for
    department heads — the frontend already hid this control from
    system_admin (view-only oversight), now the API rejects it too.
    """
    system_admin = SystemAdminFactory()
    report = ReportFactory(status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.patch(f'/api/v1/reports/{report.id}/status/', {'status': Status.ACKNOWLEDGED})

    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == Status.NEW


@pytest.mark.django_db
def test_uninvolved_department_member_cannot_update_status():
    """A plain member of the report's department who isn't the assigned responder still can't touch it."""
    department = DepartmentFactory()
    member = UserFactory(role='staff')
    other_member = UserFactory(role='staff')
    department.members.add(member, other_member)
    report = ReportFactory(department=department, assigned_to=other_member, status=Status.NEW)

    client = APIClient()
    client.force_authenticate(user=member)
    response = client.patch(f'/api/v1/reports/{report.id}/status/', {'status': Status.ACKNOWLEDGED})

    assert response.status_code == 404
