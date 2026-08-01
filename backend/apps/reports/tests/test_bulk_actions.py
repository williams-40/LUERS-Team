import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ICTAdminFactory, ManagementFactory, ReportFactory
from apps.audit.models import AuditLog
from apps.core.choices import Status, Action


@pytest.mark.django_db
def test_bulk_status_update_requires_security():
    for role_factory in [lambda: UserFactory(role='student'), lambda: UserFactory(role='staff'),
                          ICTAdminFactory, ManagementFactory]:
        user = role_factory()
        report = ReportFactory()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post('/api/v1/reports/bulk/status/', {
            'report_ids': [str(report.id)], 'status': Status.ACKNOWLEDGED,
        }, format='json')
        assert response.status_code == 403, f"{user.role} got {response.status_code}"


@pytest.mark.django_db
def test_bulk_status_update_all_succeed():
    security = SecurityFactory()
    reports = [ReportFactory(status=Status.NEW) for _ in range(3)]

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
    already_there = ReportFactory(status=Status.ACKNOWLEDGED)
    needs_update = ReportFactory(status=Status.NEW)

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
    reports = [ReportFactory(status=Status.NEW) for _ in range(2)]

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
def test_bulk_assign_requires_security_or_ict_admin():
    for role_factory in [lambda: UserFactory(role='student'), ManagementFactory]:
        user = role_factory()
        officer = SecurityFactory()
        report = ReportFactory()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post('/api/v1/reports/bulk/assign/', {
            'report_ids': [str(report.id)], 'assigned_to': str(officer.id),
        }, format='json')
        assert response.status_code == 403, f"{user.role} got {response.status_code}"


@pytest.mark.django_db
def test_bulk_assign_all_succeed():
    ict_admin = ICTAdminFactory()
    officer = SecurityFactory()
    reports = [ReportFactory() for _ in range(3)]

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
def test_bulk_assign_rejects_non_security_officer():
    security = SecurityFactory()
    non_officer = UserFactory(role='staff')
    report = ReportFactory()

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post('/api/v1/reports/bulk/assign/', {
        'report_ids': [str(report.id)], 'assigned_to': str(non_officer.id),
    }, format='json')

    assert response.status_code == 400
    assert 'assigned_to' in response.data


@pytest.mark.django_db
def test_bulk_assign_partial_failure_inaccessible_report():
    security = SecurityFactory()
    officer = SecurityFactory()
    real_report = ReportFactory()
    fake_id = '11111111-2222-3333-4444-555555555555'

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.post('/api/v1/reports/bulk/assign/', {
        'report_ids': [str(real_report.id), fake_id], 'assigned_to': str(officer.id),
    }, format='json')

    assert response.status_code == 200
    results = {r['report_id']: r for r in response.data['results']}
    assert results[str(real_report.id)]['status'] == 'success'
    assert results[fake_id]['status'] == 'error'
