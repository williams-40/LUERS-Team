import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, AnonymousReportFactory

@pytest.mark.django_db
def test_anonymous_report_does_not_expose_reporter():
    # Create an anonymous report with a real reporter
    reporter = UserFactory()
    report = AnonymousReportFactory()
    # Manually link report identity to reporter (use placeholder)
    from apps.reports.models import ReportIdentity
    ReportIdentity.objects.create(
        report=report,
        encrypted_reporter_ref=f"PLACEHOLDER_{reporter.id}"
    )

    # Security user fetches the report
    security = SecurityFactory()
    client = APIClient()
    client.force_authenticate(user=security)

    # List reports
    response = client.get('/api/v1/reports/')
    assert response.status_code == 200
    data = response.data['results']  # paginated
    found = False
    for r in data:
        if r['id'] == str(report.id):
            found = True
            # Ensure no reporter identity is present
            assert 'reporter' not in r
            assert 'identity' not in r
            assert 'user' not in r
    assert found

    # Detail view
    response = client.get(f'/api/v1/reports/{report.id}/')
    assert response.status_code == 200
    assert 'reporter' not in response.data
    assert 'identity' not in response.data