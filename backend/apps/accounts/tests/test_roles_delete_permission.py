import pytest
from rest_framework.test import APIClient
from apps.core.factories import ICTAdminFactory, SystemAdminFactory, ReportFactory


@pytest.mark.django_db
def test_ict_admin_cannot_delete_report_system_admin_can():
    ict_admin = ICTAdminFactory()
    system_admin = SystemAdminFactory()
    report = ReportFactory()

    client = APIClient()
    client.force_authenticate(user=ict_admin)
    response = client.post(f'/api/v1/reports/{report.id}/delete/')
    assert response.status_code == 403

    client.force_authenticate(user=system_admin)
    response = client.post(f'/api/v1/reports/{report.id}/delete/')
    assert response.status_code == 200
