import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from apps.core.factories import SecurityFactory, StaffFactory, ReportFactory, DepartmentFactory

VALID_JPEG_BYTES = b'\xff\xd8\xff\xe0' + b'\x00' * 32
SPOOFED_PDF_AS_JPEG = b'%PDF-1.4\n' + b'\x00' * 32


@pytest.mark.django_db
def test_evidence_upload_rejects_content_extension_mismatch():
    security = SecurityFactory()
    report = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.jpg', SPOOFED_PDF_AS_JPEG, content_type='image/jpeg')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 400
    assert "doesn't match" in resp.data['error']


@pytest.mark.django_db
def test_evidence_upload_accepts_valid_content():
    security = SecurityFactory()
    report = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.jpg', VALID_JPEG_BYTES, content_type='image/jpeg')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 201
    assert resp.data['file_type'] == 'image'


@pytest.mark.django_db
def test_evidence_upload_rejects_disallowed_extension():
    security = SecurityFactory()
    report = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.exe', b'MZ' + b'\x00' * 32, content_type='application/octet-stream')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 400
    assert 'not allowed' in resp.data['error']


@pytest.mark.django_db
def test_report_create_rejects_spoofed_inline_evidence():
    staff = StaffFactory()
    department = DepartmentFactory()
    client = APIClient()
    client.force_authenticate(user=staff)

    file = SimpleUploadedFile('evidence.jpg', SPOOFED_PDF_AS_JPEG, content_type='image/jpeg')
    resp = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'Inline evidence spoof test',
        'urgency': 'normal',
        'is_anonymous': False,
        'evidence': [file],
    }, format='multipart')

    assert resp.status_code == 400
    assert 'evidence' in resp.data
