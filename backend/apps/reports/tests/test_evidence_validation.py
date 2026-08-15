import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from apps.core.factories import SecurityFactory, StaffFactory, ReportFactory, DepartmentFactory

VALID_JPEG_BYTES = b'\xff\xd8\xff\xe0' + b'\x00' * 32
SPOOFED_PDF_AS_JPEG = b'%PDF-1.4\n' + b'\x00' * 32


def _report_assigned_to(user):
    """
    Phase 1: evidence-upload access is now object-level (assigned
    responder/department head/System Admin/owner — see
    apps.reports.services.can_upload_evidence), replacing the old
    hardcoded role.slug == 'security' check. These tests are about
    file-content validation, not access scoping, so give `user` a
    realistic assigned-responder relationship to the report.
    """
    department = DepartmentFactory()
    department.members.add(user)
    return ReportFactory(department=department, assigned_to=user)


@pytest.mark.django_db
def test_evidence_upload_rejects_content_extension_mismatch():
    security = SecurityFactory()
    report = _report_assigned_to(security)
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.jpg', SPOOFED_PDF_AS_JPEG, content_type='image/jpeg')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 400
    assert "doesn't match" in resp.data['error']


@pytest.mark.django_db
def test_evidence_upload_accepts_valid_content():
    security = SecurityFactory()
    report = _report_assigned_to(security)
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.jpg', VALID_JPEG_BYTES, content_type='image/jpeg')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 201
    assert resp.data['file_type'] == 'image'


@pytest.mark.django_db
def test_evidence_upload_rejects_disallowed_extension():
    security = SecurityFactory()
    report = _report_assigned_to(security)
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.exe', b'MZ' + b'\x00' * 32, content_type='application/octet-stream')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 400
    assert 'not allowed' in resp.data['error']


@pytest.mark.django_db
def test_evidence_upload_rejected_for_unaffiliated_security_role_user():
    """
    Phase 1 fix: the 'security' role no longer grants blanket evidence-
    upload access on its own — only an actual relationship to the report
    (assigned responder, department head, System Admin, or owner) does.
    """
    security = SecurityFactory()
    report = ReportFactory()
    client = APIClient()
    client.force_authenticate(user=security)

    file = SimpleUploadedFile('evidence.jpg', VALID_JPEG_BYTES, content_type='image/jpeg')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 403


@pytest.mark.django_db
def test_evidence_upload_allowed_for_non_security_department_head():
    """
    Phase 1 fix: a department head who doesn't hold the 'security' role
    (e.g. one of the department-officer roles from the live system) can
    now upload evidence for their own department's reports — the old
    hardcoded check excluded them entirely regardless of headship.
    """
    head = StaffFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department)
    client = APIClient()
    client.force_authenticate(user=head)

    file = SimpleUploadedFile('evidence.jpg', VALID_JPEG_BYTES, content_type='image/jpeg')
    resp = client.post(f'/api/v1/reports/{report.id}/evidence/', {'file': file}, format='multipart')

    assert resp.status_code == 201


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
