import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.core.choices import Status, Urgency, Action
from apps.reports.services import ReportService
from apps.dashboard.analytics import compute_dashboard_analytics


@pytest.mark.django_db
def test_analytics_endpoint_requires_admin_tier():
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get('/api/v1/dashboard/analytics/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_analytics_status_breakdown():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    ReportFactory(department=department, status=Status.NEW)
    ReportFactory(department=department, status=Status.ACKNOWLEDGED)
    ReportFactory(department=department, status=Status.IN_PROGRESS)
    ReportFactory(department=department, status=Status.RESOLVED)
    ReportFactory(department=department, status=Status.CLOSED)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.get('/api/v1/dashboard/analytics/')

    assert response.status_code == 200
    assert response.data['total'] == 5
    assert response.data['open'] == 2  # new + acknowledged
    assert response.data['in_progress'] == 1
    assert response.data['resolved'] == 1
    assert response.data['closed'] == 1


@pytest.mark.django_db
def test_analytics_scoped_to_department_head_not_campus_wide():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    ReportFactory(department=department)
    ReportFactory()  # unrelated, different department

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.get('/api/v1/dashboard/analytics/')

    assert response.data['total'] == 1


@pytest.mark.django_db
def test_analytics_system_admin_sees_everything():
    system_admin = SystemAdminFactory()
    ReportFactory()
    ReportFactory(department=DepartmentFactory())

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/dashboard/analytics/')

    assert response.data['total'] == 2


@pytest.mark.django_db
def test_average_assignment_time_hours():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department)
    report.created_at = timezone.now() - timedelta(hours=5)
    report.save(update_fields=['created_at'])

    ReportService.assign_report(report, head, head, ip_address='127.0.0.1')

    result = compute_dashboard_analytics(head)
    assert result['average_assignment_time_hours'] is not None
    assert result['average_assignment_time_hours'] > 4


@pytest.mark.django_db
def test_overdue_counts_panic_reports_past_4_hours():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    overdue = ReportFactory(department=department, urgency=Urgency.PANIC, status=Status.NEW)
    overdue.created_at = timezone.now() - timedelta(hours=5)
    overdue.save(update_fields=['created_at'])

    not_overdue = ReportFactory(department=department, urgency=Urgency.PANIC, status=Status.NEW)
    not_overdue.created_at = timezone.now() - timedelta(hours=1)
    not_overdue.save(update_fields=['created_at'])

    result = compute_dashboard_analytics(head)
    assert result['overdue'] == 1


@pytest.mark.django_db
def test_responder_workload_and_performance():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    responder = UserFactory(role='staff')
    department.members.add(responder)

    ReportFactory(department=department, assigned_to=responder, status=Status.IN_PROGRESS)
    ReportFactory(department=department, assigned_to=responder, status=Status.RESOLVED)

    result = compute_dashboard_analytics(head)
    workload = {w['responder_id']: w for w in result['responder_workload']}
    assert workload[str(responder.id)]['open_count'] == 1

    performance = {p['responder_id']: p for p in result['responder_performance']}
    assert performance[str(responder.id)]['resolved_count'] == 1


@pytest.mark.django_db
def test_top_keywords_counts_description_words():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    ReportFactory(department=department, description='the laptop keeps disconnecting from wifi')
    ReportFactory(department=department, description='my laptop wifi is broken again')

    result = compute_dashboard_analytics(head)
    keywords = {k['keyword']: k['count'] for k in result['top_keywords']}
    assert keywords.get('laptop') == 2
    assert keywords.get('wifi') == 2
    assert 'the' not in keywords  # stopword
