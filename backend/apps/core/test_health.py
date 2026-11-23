import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_healthz_returns_ok():
    client = APIClient()
    resp = client.get('/healthz/')
    assert resp.status_code == 200
    assert resp.data['status'] == 'ok'
    assert resp.data['checks']['database'] is True
    assert resp.data['checks']['cache'] is True


def test_healthz_does_not_require_auth():
    client = APIClient()
    resp = client.get('/healthz/')
    assert resp.status_code in (200, 503)
