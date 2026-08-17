import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, ReportFactory, DepartmentFactory
from apps.notifications.models import Message

VALID_EBML_BYTES = b'\x1a\x45\xdf\xa3' + b'\x00' * 32


@pytest.mark.django_db
def test_list_messages_requires_authentication():
    report = ReportFactory()
    client = APIClient()
    response = client.get(f'/api/v1/reports/{report.id}/messages/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_system_admin_can_list_messages_for_any_report():
    """
    Phase 1: CanAccessReportMixin now delegates to get_accessible_reports
    (the single source of truth also used by REST detail/list and the
    WebSocket consumer) instead of its own view_admin_dashboard-based
    blanket check — so genuine campus-wide access requires view_all_reports
    (System Admin), not just admin-tier dashboard access.
    """
    report = ReportFactory()
    Message.objects.create(report=report, sender=SecurityFactory(), content='hello')

    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200
    assert response.data['results'][0]['content'] == 'hello'


@pytest.mark.django_db
def test_department_head_can_list_messages_for_department_report():
    head = SecurityFactory()
    department = DepartmentFactory(head=head)
    report = ReportFactory(department=department)
    Message.objects.create(report=report, sender=head, content='hello')

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200
    assert response.data['results'][0]['content'] == 'hello'


@pytest.mark.django_db
def test_unaffiliated_admin_tier_user_cannot_list_messages():
    """
    Phase 1 fix: previously view_admin_dashboard alone (e.g. a plain
    Security-role user with no department relationship to this report)
    granted blanket messages access — a real divergence from
    get_accessible_reports, which every other report-access surface
    already used. Confirms the fix: admin-tier alone is no longer enough.
    """
    report = ReportFactory()
    unaffiliated = SecurityFactory()

    client = APIClient()
    client.force_authenticate(user=unaffiliated)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_unrelated_student_cannot_list_messages():
    report = ReportFactory()
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_reporter_can_list_their_own_report_messages():
    student = UserFactory(role='student')
    report = ReportFactory(reporter=student)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_assigned_officer_can_list_messages():
    # get_accessible_reports requires both department membership AND
    # assigned_to (see apps.reports.services) — in real usage this always
    # holds, since ReportAssignView only ever assigns a department
    # member/head in the first place. Mirrored here rather than relying on
    # assigned_to alone, which CanAccessReportMixin's old, now-retired
    # standalone check didn't require.
    security = SecurityFactory()
    department = DepartmentFactory()
    department.members.add(security)
    report = ReportFactory(department=department, assigned_to=security)

    client = APIClient()
    client.force_authenticate(user=security)
    response = client.get(f'/api/v1/reports/{report.id}/messages/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_create_message_requires_authentication():
    report = ReportFactory()
    client = APIClient()
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'hi'})
    assert response.status_code == 401


@pytest.mark.django_db
def test_system_admin_can_create_message():
    report = ReportFactory()
    admin = SystemAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'on my way'})

    assert response.status_code == 201
    assert response.data['content'] == 'on my way'
    assert response.data['sender_username'] == admin.username
    assert Message.objects.filter(report=report, sender=admin).exists()


@pytest.mark.django_db
def test_unaffiliated_admin_tier_user_cannot_create_message():
    report = ReportFactory()
    unaffiliated = SecurityFactory()

    client = APIClient()
    client.force_authenticate(user=unaffiliated)
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'hi'})

    assert response.status_code == 403
    assert not Message.objects.filter(report=report).exists()


@pytest.mark.django_db
def test_unrelated_student_cannot_create_message():
    report = ReportFactory()
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {'content': 'hi'})

    assert response.status_code == 403
    assert not Message.objects.filter(report=report).exists()


@pytest.mark.django_db
def test_create_message_rejects_content_over_max_length():
    report = ReportFactory()
    admin = SystemAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(
        f'/api/v1/reports/{report.id}/messages/create/', {'content': 'x' * 2001},
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_message_rejects_neither_content_nor_attachment():
    report = ReportFactory()
    admin = SystemAdminFactory()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(f'/api/v1/reports/{report.id}/messages/create/', {})

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_voice_message_without_content_succeeds():
    """A voice note stands on its own, same as a text message — content is
    only required when there's no attachment (see MessageCreateSerializer)."""
    report = ReportFactory()
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    file = SimpleUploadedFile('recording.weba', VALID_EBML_BYTES, content_type='audio/webm')
    response = client.post(
        f'/api/v1/reports/{report.id}/messages/create/', {'attachment': file}, format='multipart',
    )

    assert response.status_code == 201
    assert response.data['content'] == ''
    assert response.data['attachment_url'] is not None
    message = Message.objects.get(report=report, sender=admin)
    assert message.attachment.name.endswith('.weba')


@pytest.mark.django_db
def test_create_voice_message_rejects_spoofed_attachment():
    report = ReportFactory()
    admin = SystemAdminFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    file = SimpleUploadedFile('recording.weba', b'not-actually-ebml' + b'\x00' * 32, content_type='audio/webm')
    response = client.post(
        f'/api/v1/reports/{report.id}/messages/create/', {'attachment': file}, format='multipart',
    )

    assert response.status_code == 400
    assert 'attachment' in response.data
