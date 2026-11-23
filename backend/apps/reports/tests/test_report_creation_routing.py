import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, DepartmentFactory
from apps.audit.models import AuditLog
from apps.core.choices import Action
from apps.reports.models import Report


@pytest.mark.django_db
def test_create_report_with_a_real_department_is_user_selected():
    student = UserFactory(role='student')
    department = DepartmentFactory(name='Estates / Maintenance')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(department.id),
        'description': 'The tap in my hostel room is leaking badly',
        'urgency': 'normal',
        'is_anonymous': False,
        'phone_number': '0700000000',
    })

    assert response.status_code == 201
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == department.id

    create_entry = AuditLog.objects.get(report=report, action=Action.CREATE)
    assert create_entry.after_state['department'] == 'Estates / Maintenance'
    assert create_entry.after_state['department_source'] == 'user_selected'
    assert not AuditLog.objects.filter(report=report, action=Action.AUTO_ROUTE).exists()


@pytest.mark.django_db
def test_create_report_under_other_with_high_confidence_auto_routes():
    student = UserFactory(role='student')
    other = DepartmentFactory(name='Other')
    ict = DepartmentFactory(name='ICT Services')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(other.id),
        'description': 'My laptop wifi and password keep failing on the network',
        'urgency': 'normal',
        'is_anonymous': False,
        'phone_number': '0700000000',
    })

    assert response.status_code == 201
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == ict.id

    create_entry = AuditLog.objects.get(report=report, action=Action.CREATE)
    assert create_entry.after_state['department_source'] == 'auto_inferred'
    auto_route_entry = AuditLog.objects.get(report=report, action=Action.AUTO_ROUTE)
    assert auto_route_entry.after_state['department'] == 'ICT Services'
    assert auto_route_entry.after_state['confidence'] >= 0.8


@pytest.mark.django_db
def test_create_report_under_other_with_medium_confidence_stores_suggestion():
    student = UserFactory(role='student')
    other = DepartmentFactory(name='Other')
    DepartmentFactory(name='Library')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(other.id),
        'description': 'Can I borrow this book, please',
        'urgency': 'normal',
        'is_anonymous': False,
        'phone_number': '0700000000',
    })

    assert response.status_code == 201
    report = Report.objects.get(id=response.data['id'])
    # Stays in Other — medium confidence is a suggestion, not an auto-move.
    assert report.department_id == other.id
    assert report.metadata['routing_suggestion']['suggested_department'] == 'Library'

    create_entry = AuditLog.objects.get(report=report, action=Action.CREATE)
    assert create_entry.after_state['department_source'] == 'unclassified_pending_review'
    suggestion_entry = AuditLog.objects.get(report=report, action=Action.ROUTING_SUGGESTION)
    assert suggestion_entry.after_state['suggested_department'] == 'Library'


@pytest.mark.django_db
def test_create_report_under_other_with_no_match_stays_unclassified():
    student = UserFactory(role='student')
    other = DepartmentFactory(name='Other')

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(other.id),
        'description': 'Something happened and I am not sure who handles this',
        'urgency': 'normal',
        'is_anonymous': False,
        'phone_number': '0700000000',
    })

    assert response.status_code == 201
    report = Report.objects.get(id=response.data['id'])
    assert report.department_id == other.id
    create_entry = AuditLog.objects.get(report=report, action=Action.CREATE)
    assert create_entry.after_state['department_source'] == 'unclassified_pending_review'
    assert not AuditLog.objects.filter(report=report, action=Action.ROUTING_SUGGESTION).exists()


@pytest.mark.django_db
def test_create_report_requires_active_department():
    student = UserFactory(role='student')
    inactive = DepartmentFactory(is_active=False)

    client = APIClient()
    client.force_authenticate(user=student)
    response = client.post('/api/v1/reports/create/', {
        'department': str(inactive.id),
        'description': 'Test against an inactive department',
        'urgency': 'normal',
        'is_anonymous': False,
    })

    assert response.status_code == 400
    assert 'department' in response.data
