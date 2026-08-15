import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.audit.models import AuditLog
from apps.core.choices import Action, Status
from apps.reports.services import ReportService
from apps.reports.models import ReportFeedback


def _resolved_report_with_reporter():
    department = DepartmentFactory()
    responder = UserFactory(role='staff')
    department.members.add(responder)
    reporter = UserFactory(role='student')
    report = ReportFactory(department=department, assigned_to=responder, status=Status.NEW, reporter=reporter)
    ReportService.update_status(report, Status.RESOLVED, responder)
    report.refresh_from_db()
    return report, reporter, responder, department


@pytest.mark.django_db
def test_resolving_a_report_logs_feedback_requested():
    report, reporter, responder, department = _resolved_report_with_reporter()
    assert AuditLog.objects.filter(report=report, action=Action.FEEDBACK_REQUESTED).exists()


@pytest.mark.django_db
def test_reporter_can_submit_feedback_and_report_auto_closes():
    report, reporter, responder, department = _resolved_report_with_reporter()

    client = APIClient()
    client.force_authenticate(user=reporter)
    response = client.post(f'/api/v1/reports/{report.id}/feedback/', {
        'rating': 5, 'comments': 'Handled quickly, thank you.',
    })

    assert response.status_code == 201
    report.refresh_from_db()
    assert report.status == Status.CLOSED
    assert ReportFeedback.objects.filter(report=report, rating=5).exists()

    assert AuditLog.objects.filter(report=report, action=Action.SUBMIT_FEEDBACK).exists()
    close_entry = AuditLog.objects.filter(report=report, action=Action.STATUS_UPDATE, after_state__status='closed').first()
    assert close_entry is not None
    assert close_entry.actor_id == reporter.id


@pytest.mark.django_db
def test_non_reporter_cannot_submit_feedback():
    report, reporter, responder, department = _resolved_report_with_reporter()

    client = APIClient()
    client.force_authenticate(user=responder)
    response = client.post(f'/api/v1/reports/{report.id}/feedback/', {'rating': 4})
    assert response.status_code == 403


@pytest.mark.django_db
def test_cannot_submit_feedback_before_resolved():
    department = DepartmentFactory()
    reporter = UserFactory(role='student')
    report = ReportFactory(department=department, status=Status.NEW, reporter=reporter)

    client = APIClient()
    client.force_authenticate(user=reporter)
    response = client.post(f'/api/v1/reports/{report.id}/feedback/', {'rating': 4})
    assert response.status_code == 400


@pytest.mark.django_db
def test_cannot_submit_feedback_twice():
    report, reporter, responder, department = _resolved_report_with_reporter()

    client = APIClient()
    client.force_authenticate(user=reporter)
    client.post(f'/api/v1/reports/{report.id}/feedback/', {'rating': 5})

    response = client.post(f'/api/v1/reports/{report.id}/feedback/', {'rating': 2})
    assert response.status_code == 400
    assert ReportFeedback.objects.filter(report=report).count() == 1


@pytest.mark.django_db
def test_pending_feedback_list_scoped_to_reporter():
    report, reporter, responder, department = _resolved_report_with_reporter()
    other_user = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=reporter)
    response = client.get('/api/v1/reports/pending-feedback/')
    assert response.status_code == 200
    assert any(r['id'] == str(report.id) for r in response.data['results'])

    client.force_authenticate(user=other_user)
    response = client.get('/api/v1/reports/pending-feedback/')
    assert response.status_code == 200
    assert not any(r['id'] == str(report.id) for r in response.data['results'])


@pytest.mark.django_db
def test_department_member_can_view_feedback_and_it_is_logged():
    report, reporter, responder, department = _resolved_report_with_reporter()

    client = APIClient()
    client.force_authenticate(user=reporter)
    client.post(f'/api/v1/reports/{report.id}/feedback/', {'rating': 5})

    client.force_authenticate(user=responder)
    response = client.get(f'/api/v1/reports/{report.id}/feedback/')
    assert response.status_code == 200
    assert response.data['rating'] == 5
    assert AuditLog.objects.filter(report=report, action=Action.VIEW_FEEDBACK, actor=responder).exists()


@pytest.mark.django_db
def test_admin_feedback_list_is_admin_only():
    report, reporter, responder, department = _resolved_report_with_reporter()

    client = APIClient()
    client.force_authenticate(user=reporter)
    client.post(f'/api/v1/reports/{report.id}/feedback/', {'rating': 5})

    system_admin = SystemAdminFactory()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/feedback/')
    assert response.status_code == 200
    assert any(f['report_id'] == str(report.id) for f in response.data['results'])

    client.force_authenticate(user=responder)
    response = client.get('/api/v1/reports/feedback/')
    assert response.status_code == 403
