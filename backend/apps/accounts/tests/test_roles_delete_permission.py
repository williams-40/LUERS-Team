import pytest
from rest_framework.test import APIClient
from apps.accounts.models import Role
from apps.core.factories import ICTAdminFactory, SystemAdminFactory, ReportFactory


@pytest.mark.django_db
def test_ict_admin_role_no_longer_has_delete_report():
    ict_admin = Role.objects.get(slug='ict_admin')
    system_admin = Role.objects.get(slug='system_admin')
    assert not ict_admin.permissions.filter(slug='delete_report').exists()
    assert system_admin.permissions.filter(slug='delete_report').exists()


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
