import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, ICTAdminFactory, ManagementFactory, StaffFactory, DepartmentFactory

ENDPOINTS = {
    '/api/v1/reports/': 'GET',
    '/api/v1/reports/mine/': 'GET',
    '/api/v1/reports/create/': 'POST',
    '/api/v1/dashboard/summary/': 'GET',
}

# Expected status codes per role.
# GET /api/v1/reports/ is IsAuthenticated-only (any role gets 200; visibility is
# scoped server-side via get_accessible_reports, not gated at the permission layer).
ROLE_MATRIX = {
    'student': {
        '/api/v1/reports/': 200,
        '/api/v1/reports/mine/': 200,
        '/api/v1/reports/create/': 201,   # valid data will be provided
        '/api/v1/dashboard/summary/': 403,
    },
    'security': {
        '/api/v1/reports/': 200,
        '/api/v1/reports/mine/': 403,
        '/api/v1/reports/create/': 403,
        '/api/v1/dashboard/summary/': 200,
    },
    'ict_admin': {
        '/api/v1/reports/': 200,
        '/api/v1/reports/mine/': 403,
        '/api/v1/reports/create/': 403,
        '/api/v1/dashboard/summary/': 200,
    },
    'management': {
        '/api/v1/reports/': 200,
        '/api/v1/reports/mine/': 403,
        '/api/v1/reports/create/': 403,
        # Phase 14: dashboard views opened from IsSecurity|IsICTAdmin to the
        # full IsAdminTier (management/system_admin were an accidental gap,
        # not a deliberate exclusion).
        '/api/v1/dashboard/summary/': 200,
    },
}

@pytest.mark.django_db
def test_rbac_matrix():
    client = APIClient()
    department = DepartmentFactory()
    # Valid data for report creation
    valid_create_data = {
        'department': str(department.id),
        'description': 'Test RBAC',
        'urgency': 'normal',
        'is_anonymous': False,
        'latitude': 2.2333,
        'longitude': 32.8999,
    }

    for role, expected in ROLE_MATRIX.items():
        user = UserFactory(role=role)
        client.force_authenticate(user=user)
        for url, method in ENDPOINTS.items():
            if method == 'GET':
                response = client.get(url)
            elif method == 'POST':
                # For create endpoint, send valid data; for others, send empty dict
                data = valid_create_data if url == '/api/v1/reports/create/' else {}
                response = client.post(url, data, format='json')
            assert response.status_code == expected[url], f"Role {role} on {url} got {response.status_code}"