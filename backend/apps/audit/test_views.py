import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ICTAdminFactory, ReportFactory, DepartmentFactory
from apps.reports.services import ReportService
from apps.core.choices import Status, Action
from apps.audit.models import AuditLog


@pytest.mark.django_db
def test_audit_list_returns_empty_for_user_with_no_department_affiliation():
    """
    Phase 4: no standalone manage_audit_logs permission gate anymore —
    /api/v1/audit/ is IsAuthenticated only, scoped entirely by
    get_accessible_audit_logs. A student with no department affiliation
    at all gets 200 with an empty list, not a 403.
    """
    student = UserFactory(role='student')
    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get('/api/v1/audit/')
    assert response.status_code == 200
    assert response.data['results'] == []


@pytest.mark.django_db
def test_audit_list_visible_to_admin_tier():
    security = SecurityFactory()
    department = DepartmentFactory()
    department.members.add(security)
    report = ReportFactory(department=department, assigned_to=security)
    ReportService.update_status(report, Status.ACKNOWLEDGED, security, ip_address='127.0.0.1')

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/audit/')
    assert response.status_code == 200
    actions = [entry['action'] for entry in response.data['results']]
    assert Action.STATUS_UPDATE in actions
    entry = next(e for e in response.data['results'] if e['action'] == Action.STATUS_UPDATE)
    assert str(entry['actor']) == str(security.id)


@pytest.mark.django_db
def test_audit_entry_captures_client_ip_and_user_agent():
    """
    "Accessed from" context on the audit log — real, always-available
    ip_address + user_agent instead of an IP geolocation lookup that would
    just say "Unknown" for the private/LAN IPs this app is actually used
    from (see AuditLogPage.tsx's summarizeUserAgent).
    """
    student = UserFactory(role='student')
    DepartmentFactory(name='Security')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post(
        '/api/v1/reports/create/',
        {'urgency': 'panic', 'emergency_type': 'security'},
        HTTP_USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
    )

    assert response.status_code == 201, response.data
    entry = AuditLog.objects.get(report_id=response.data['id'], action=Action.CREATE)
    assert entry.ip_address == '127.0.0.1'
    assert entry.user_agent == 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36'


@pytest.mark.django_db
def test_audit_list_filters_by_action():
    security = SecurityFactory()
    report = ReportFactory()
    ReportService.update_status(report, Status.ACKNOWLEDGED, security, ip_address='127.0.0.1')

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get('/api/v1/audit/', {'action': Action.CREATE})
    assert response.status_code == 200
    assert all(e['action'] == Action.CREATE for e in response.data['results'])


@pytest.mark.django_db
def test_audit_export_csv():
    ict_admin = ICTAdminFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=ict_admin)
    response = client.get('/api/v1/audit/export/', {'export_format': 'csv'})
    assert response.status_code == 200
    assert response['Content-Type'] == 'text/csv'


@pytest.mark.django_db
def test_audit_export_pdf():
    ict_admin = ICTAdminFactory()
    ReportFactory()

    client = APIClient()
    client.force_authenticate(user=ict_admin)
    response = client.get('/api/v1/audit/export/', {'export_format': 'pdf'})
    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
