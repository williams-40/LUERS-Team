import pytest
from rest_framework.test import APIClient
from apps.core.factories import UserFactory, SecurityFactory, SystemAdminFactory, DepartmentFactory


@pytest.mark.django_db
def test_department_head_only_sees_own_department_officers():
    """
    /api/v1/auth/officers/ powers the triage queue's bulk-assign toolbar —
    a department head selecting reports (all of which get_accessible_reports
    already scopes to their own department anyway) should only see their
    own department's head+members in the picker, not the whole campus.
    """
    head = SecurityFactory()
    own_department = DepartmentFactory(head=head)
    own_member = UserFactory(role='staff')
    own_department.members.add(own_member)

    other_head = SecurityFactory()
    other_department = DepartmentFactory(head=other_head)
    other_member = UserFactory(role='staff')
    other_department.members.add(other_member)

    client = APIClient()
    client.force_authenticate(user=head)
    response = client.get('/api/v1/auth/officers/')

    assert response.status_code == 200
    ids = {o['id'] for o in response.data}
    assert str(head.id) in ids
    assert str(own_member.id) in ids
    assert str(other_head.id) not in ids
    assert str(other_member.id) not in ids


@pytest.mark.django_db
def test_responder_only_sees_own_department_officers():
    department = DepartmentFactory()
    # The caller must itself hold view_admin_dashboard (responder/head/
    # system_admin) to reach this endpoint at all — a plain reporter-tier
    # department member never could, so this deliberately authenticates as
    # a responder-tier member, not a plain UserFactory(role='staff').
    calling_responder = SecurityFactory()
    other_member = UserFactory(role='staff')
    department.members.add(calling_responder, other_member)

    other_department = DepartmentFactory()
    outsider = UserFactory(role='staff')
    other_department.members.add(outsider)

    client = APIClient()
    client.force_authenticate(user=calling_responder)
    response = client.get('/api/v1/auth/officers/')

    assert response.status_code == 200
    ids = {o['id'] for o in response.data}
    assert str(calling_responder.id) in ids
    assert str(other_member.id) in ids
    assert str(outsider.id) not in ids


@pytest.mark.django_db
def test_system_admin_sees_campus_wide_officer_list():
    system_admin = SystemAdminFactory()
    dept_a = DepartmentFactory()
    member_a = UserFactory(role='staff')
    dept_a.members.add(member_a)
    dept_b = DepartmentFactory()
    member_b = UserFactory(role='staff')
    dept_b.members.add(member_b)

    client = APIClient()
    client.force_authenticate(user=system_admin)
    response = client.get('/api/v1/auth/officers/')

    assert response.status_code == 200
    ids = {o['id'] for o in response.data}
    assert str(member_a.id) in ids
    assert str(member_b.id) in ids


@pytest.mark.django_db
def test_officer_with_no_department_sees_empty_list():
    unassigned_responder = SecurityFactory()  # not a head or member of any department

    client = APIClient()
    client.force_authenticate(user=unassigned_responder)
    response = client.get('/api/v1/auth/officers/')

    assert response.status_code == 200
    assert response.data == []
