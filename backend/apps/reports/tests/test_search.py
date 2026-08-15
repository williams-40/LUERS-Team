import pytest
from rest_framework.test import APIClient
from apps.core.factories import SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.core.choices import Status

# These tests are about the search/filter logic itself, not access
# scoping — the acting user is System Admin throughout (sees everything
# unconditionally) so department/assignment setup doesn't get in the way
# of what's actually being tested.


@pytest.mark.django_db
def test_search_matches_description_substring():
    system_admin = SystemAdminFactory()
    ReportFactory(description='Someone stole my bike from the rack.')
    ReportFactory(description='Fire alarm went off in the library.')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'bike'})

    assert response.status_code == 200
    assert len(response.data['results']) == 1
    assert 'bike' in response.data['results'][0]['description']


@pytest.mark.django_db
def test_search_is_case_insensitive():
    system_admin = SystemAdminFactory()
    ReportFactory(description='Someone stole my BIKE from the rack.')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'bike'})

    assert response.status_code == 200
    assert len(response.data['results']) == 1


@pytest.mark.django_db
def test_search_matches_assigned_officer_username():
    system_admin = SystemAdminFactory()
    officer = SecurityFactory(username='officer_jane')
    ReportFactory(assigned_to=officer, description='unrelated')
    ReportFactory(description='also unrelated')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'officer_jane'})

    assert response.status_code == 200
    assert len(response.data['results']) == 1
    assert response.data['results'][0]['assigned_to_username'] == 'officer_jane'


@pytest.mark.django_db
def test_search_matches_custom_department():
    system_admin = SystemAdminFactory()
    ReportFactory(custom_department='Housing Office', description='x')
    ReportFactory(custom_department='', description='y')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'Housing'})

    assert response.status_code == 200
    assert len(response.data['results']) == 1


@pytest.mark.django_db
def test_search_matches_department_name():
    system_admin = SystemAdminFactory()
    dept = DepartmentFactory(name='Health & Safety')
    ReportFactory(department=dept, description='x')
    ReportFactory(description='y')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'Health'})

    assert response.status_code == 200
    assert len(response.data['results']) == 1


@pytest.mark.django_db
def test_search_excludes_non_matching_reports():
    system_admin = SystemAdminFactory()
    ReportFactory(description='completely unrelated text')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'nonexistent-term-xyz'})

    assert response.status_code == 200
    assert len(response.data['results']) == 0


@pytest.mark.django_db
def test_search_combines_with_status_filter():
    system_admin = SystemAdminFactory()
    ReportFactory(description='bike theft', status=Status.NEW)
    ReportFactory(description='bike theft', status=Status.RESOLVED)

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'bike', 'status': Status.RESOLVED})

    assert response.status_code == 200
    assert len(response.data['results']) == 1
    assert response.data['results'][0]['status'] == Status.RESOLVED


@pytest.mark.django_db
def test_search_does_not_expose_reporter_identity():
    system_admin = SystemAdminFactory()
    reporter = SecurityFactory(username='real_reporter_name')
    report = ReportFactory(reporter=reporter, description='some incident')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/', {'search': 'real_reporter_name'})

    assert response.status_code == 200
    assert len(response.data['results']) == 0


@pytest.mark.django_db
def test_export_respects_search_filter():
    system_admin = SystemAdminFactory()
    ReportFactory(description='unique-search-term-bike')
    ReportFactory(description='something else entirely')

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/reports/export/', {'export_format': 'csv', 'search': 'unique-search-term'})

    assert response.status_code == 200
    body = b''.join(response.streaming_content) if response.streaming else response.content
    rows = [r for r in body.decode().splitlines() if r]
    assert len(rows) == 2  # header + 1 matching report
