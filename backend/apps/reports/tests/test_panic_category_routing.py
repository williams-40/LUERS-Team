"""
Covers ReportService._resolve_panic_department — the single priority chain
that replaced the old fixed EMERGENCY_TYPE_DEPARTMENT_MAP dict and the
keyword classifier's previous panic-Other blind spot:

  1. explicit reporter department always wins
  2. else the category's own default department
  3. else, only for categories flagged requires_description_and_routing,
     the keyword classifier (high/medium/low confidence tiers)

Plus deactivation/deletion safety: EmergencyDispatch.emergency_type is a
plain string snapshot (emergency_type_label), never an FK to the category,
so historical reports must keep displaying correctly regardless of what
later happens to the category row.
"""
import pytest
from rest_framework.test import APIClient
from apps.reports.models import Report, EmergencyDispatch, EmergencyCategory
from apps.audit.models import AuditLog
from apps.core.factories import UserFactory, DepartmentFactory, EmergencyCategoryFactory


@pytest.mark.django_db
def test_explicit_department_wins_over_category_default():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    library = DepartmentFactory(name='Library')
    EmergencyCategoryFactory(slug='security', department=security)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'security',
        'department': str(library.id),
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == library.id


@pytest.mark.django_db
def test_category_without_routing_flag_ignores_description_content():
    """
    medical/fire/accident/security are all requires_description_and_routing=
    False — their department is fixed by the category alone, and keyword
    content in an optional description must never override it.
    """
    student = UserFactory(role='student')
    health_safety = DepartmentFactory(name='Health & Safety')
    DepartmentFactory(name='Security')  # exists so a wrong keyword match would be visible
    EmergencyCategoryFactory(slug='medical', department=health_safety, requires_description_and_routing=False)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'medical',
        'description': 'Suspicious theft and robbery near the gate',  # pure Security keywords
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == health_safety.id


@pytest.mark.django_db
def test_requires_routing_high_confidence_auto_routes():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    library = DepartmentFactory(name='Library')
    EmergencyCategoryFactory(slug='other', department=security, requires_description_and_routing=True)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'other',
        # 4 Library keywords (borrow, library, book, overdue) -> capped at
        # 3/3 = full confidence, comfortably above the 0.8 high threshold.
        'description': 'I need to borrow a library book that is overdue',
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == library.id
    assert AuditLog.objects.filter(report=report, action='auto_route').exists()


@pytest.mark.django_db
def test_requires_routing_medium_confidence_keeps_fallback_and_leaves_suggestion():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    DepartmentFactory(name='Estates / Maintenance')
    EmergencyCategoryFactory(slug='other', department=security, requires_description_and_routing=True)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'other',
        # 2 Estates / Maintenance keywords (leak, repair) -> 2/3 = 0.667,
        # in the medium band (0.5 <= x < 0.8).
        'description': "There's a leak that needs repair",
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == security.id
    assert report.metadata.get('routing_suggestion', {}).get('suggested_department') == 'Estates / Maintenance'
    assert AuditLog.objects.filter(report=report, action='routing_suggestion').exists()


@pytest.mark.django_db
def test_requires_routing_low_confidence_keeps_fallback_without_suggestion():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    EmergencyCategoryFactory(slug='other', department=security, requires_description_and_routing=True)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'other',
        'description': 'Something strange is happening near the gate',
    })

    assert response.status_code == 201, response.data
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == security.id
    assert 'routing_suggestion' not in (report.metadata or {})
    assert not AuditLog.objects.filter(report=report, action='auto_route').exists()


@pytest.mark.django_db
def test_deactivating_category_does_not_break_existing_reports():
    student = UserFactory(role='student')
    health_safety = DepartmentFactory(name='Health & Safety')
    category = EmergencyCategoryFactory(slug='fire', name='Fire', department=health_safety)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'fire',
    })
    assert response.status_code == 201, response.data
    dispatch = EmergencyDispatch.objects.get(report_id=response.data['id'])

    category.is_active = False
    category.save(update_fields=['is_active'])

    dispatch.refresh_from_db()
    assert dispatch.emergency_type == 'fire'
    assert dispatch.emergency_type_label == 'Fire'


@pytest.mark.django_db
def test_deleting_category_does_not_break_existing_reports():
    student = UserFactory(role='student')
    health_safety = DepartmentFactory(name='Health & Safety')
    category = EmergencyCategoryFactory(slug='accident', name='Accident', department=health_safety)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'accident',
    })
    assert response.status_code == 201, response.data
    dispatch_id = EmergencyDispatch.objects.get(report_id=response.data['id']).id

    category.delete()
    assert not EmergencyCategory.objects.filter(slug='accident').exists()

    dispatch = EmergencyDispatch.objects.get(id=dispatch_id)
    assert dispatch.emergency_type == 'accident'
    assert dispatch.emergency_type_label == 'Accident'


@pytest.mark.django_db
def test_unrecognized_category_slug_is_rejected():
    student = UserFactory(role='student')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'not-a-real-category',
    })

    assert response.status_code == 400
    assert 'emergency_type' in response.data


@pytest.mark.django_db
def test_inactive_category_slug_is_rejected():
    student = UserFactory(role='student')
    security = DepartmentFactory(name='Security')
    EmergencyCategoryFactory(slug='security', department=security, is_active=False)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'urgency': 'panic',
        'emergency_type': 'security',
    })

    assert response.status_code == 400
    assert 'emergency_type' in response.data
