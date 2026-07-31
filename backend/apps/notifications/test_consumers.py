import json
import pytest
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken
from apps.notifications.consumers import ReportConsumer
from apps.notifications.models import Message
from apps.core.factories import UserFactory, SecurityFactory, ReportFactory, AnonymousReportFactory
from apps.core.choices import Status
from apps.reports.services import IdentityService


def token_for(user):
    return str(AccessToken.for_user(user))


async def connect(query_string=''):
    path = f'/ws/reports/{("?" + query_string) if query_string else ""}'
    communicator = WebsocketCommunicator(ReportConsumer.as_asgi(), path)
    connected, _ = await communicator.connect()
    return communicator, connected


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_rejected_without_token():
    communicator, connected = await connect()
    assert connected is False


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_rejected_with_invalid_token():
    communicator, connected = await connect('token=not-a-real-token')
    assert connected is False


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_accepted_for_admin_tier_role():
    security = await _acreate(SecurityFactory)
    communicator, connected = await connect(f'token={token_for(security)}')
    assert connected is True
    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_admin_tier_receives_broadcast_via_general_group():
    security = await _acreate(SecurityFactory)
    report = await _acreate(ReportFactory)

    communicator, connected = await connect(f'token={token_for(security)}')
    assert connected is True

    await communicator.send_to(text_data=json.dumps({
        'type': 'status_update',
        'report_id': str(report.id),
        'status': Status.ACKNOWLEDGED,
    }))

    response = await communicator.receive_from()
    payload = json.loads(response)
    assert payload['type'] == 'report_updated'
    assert payload['data']['status'] == Status.ACKNOWLEDGED

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_non_admin_without_report_id_does_not_join_general_group():
    student = await _acreate(UserFactory, role='student')
    communicator, connected = await connect(f'token={token_for(student)}')
    assert connected is True

    security = await _acreate(SecurityFactory)
    report = await _acreate(ReportFactory)
    sec_comm, _ = await connect(f'token={token_for(security)}')
    await sec_comm.send_to(text_data=json.dumps({
        'type': 'status_update',
        'report_id': str(report.id),
        'status': Status.ACKNOWLEDGED,
    }))
    await sec_comm.receive_from()  # the officer's own connection is in 'reports'

    # The student joined no groups at all, so the broadcast never reaches them.
    assert await communicator.receive_nothing() is True

    await communicator.disconnect()
    await sec_comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_reporter_joins_own_report_group_via_report_id():
    student = await _acreate(UserFactory, role='student')
    report = await _acreate(ReportFactory, is_anonymous=False)
    await _acreate(IdentityService.create_identity, report, student)

    communicator, connected = await connect(f'token={token_for(student)}&report_id={report.id}')
    assert connected is True

    other = await _acreate(SecurityFactory)
    other_comm, other_connected = await connect(f'token={token_for(other)}&report_id={report.id}')
    assert other_connected is True

    await other_comm.send_to(text_data=json.dumps({
        'type': 'chat_message',
        'report_id': str(report.id),
        'content': 'hello reporter',
    }))

    response = await communicator.receive_from()
    payload = json.loads(response)
    assert payload['type'] == 'chat_message'
    assert payload['data']['content'] == 'hello reporter'

    await communicator.disconnect()
    await other_comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_unrelated_student_does_not_join_report_group():
    student = await _acreate(UserFactory, role='student')
    report = await _acreate(ReportFactory)  # not linked to this student at all

    communicator, connected = await connect(f'token={token_for(student)}&report_id={report.id}')
    assert connected is True

    security = await _acreate(SecurityFactory)
    sec_comm, _ = await connect(f'token={token_for(security)}&report_id={report.id}')
    await sec_comm.send_to(text_data=json.dumps({
        'type': 'chat_message',
        'report_id': str(report.id),
        'content': 'not for you',
    }))
    # The security officer (admin tier) does get it back via the report group...
    await sec_comm.receive_from()
    # ...but the unrelated student, never having joined report_<id>, gets nothing.
    assert await communicator.receive_nothing() is True

    await communicator.disconnect()
    await sec_comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_receive_invalid_json_sends_error():
    security = await _acreate(SecurityFactory)
    communicator, _ = await connect(f'token={token_for(security)}')

    await communicator.send_to(text_data='not json')
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'error'
    assert response['message'] == 'Invalid JSON'

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_receive_unknown_message_type_sends_validation_error():
    security = await _acreate(SecurityFactory)
    communicator, _ = await connect(f'token={token_for(security)}')

    await communicator.send_to(text_data=json.dumps({'type': 'not_a_type'}))
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'error'
    assert response['message'] == 'Validation error'

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_status_update_rejected_for_non_security():
    ict_admin = await _acreate(UserFactory, role='ict_admin')
    report = await _acreate(ReportFactory)
    communicator, _ = await connect(f'token={token_for(ict_admin)}')

    await communicator.send_to(text_data=json.dumps({
        'type': 'status_update',
        'report_id': str(report.id),
        'status': Status.ACKNOWLEDGED,
    }))
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'error'
    assert response['message'] == 'Only security officers can update status'

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_status_update_persists_and_broadcasts():
    security = await _acreate(SecurityFactory)
    report = await _acreate(ReportFactory, status=Status.NEW)
    communicator, _ = await connect(f'token={token_for(security)}')

    await communicator.send_to(text_data=json.dumps({
        'type': 'status_update',
        'report_id': str(report.id),
        'status': Status.IN_PROGRESS,
    }))
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'report_updated'
    assert response['data']['status'] == Status.IN_PROGRESS

    await _arefresh(report)
    assert report.status == Status.IN_PROGRESS

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_message_rejected_without_report_access():
    student = await _acreate(UserFactory, role='student')
    report = await _acreate(ReportFactory)  # student has no relationship to this report

    communicator, _ = await connect(f'token={token_for(student)}&report_id={report.id}')
    await communicator.send_to(text_data=json.dumps({
        'type': 'chat_message',
        'report_id': str(report.id),
        'content': 'hi',
    }))
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'error'
    assert 'permission' in response['message']

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_message_creates_message_row():
    security = await _acreate(SecurityFactory)
    report = await _acreate(ReportFactory)
    communicator, _ = await connect(f'token={token_for(security)}&report_id={report.id}')

    await communicator.send_to(text_data=json.dumps({
        'type': 'chat_message',
        'report_id': str(report.id),
        'content': 'checking in',
    }))
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'chat_message'
    assert response['data']['content'] == 'checking in'
    assert response['data']['sender'] == security.username

    count = await _acount(Message)
    assert count == 1

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_ping_returns_pong():
    security = await _acreate(SecurityFactory)
    communicator, _ = await connect(f'token={token_for(security)}')

    await communicator.send_to(text_data=json.dumps({'type': 'ping'}))
    response = json.loads(await communicator.receive_from())
    assert response['type'] == 'pong'
    assert 'timestamp' in response

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_disconnect_leaves_all_groups_without_error():
    security = await _acreate(SecurityFactory)
    report = await _acreate(ReportFactory)
    communicator, _ = await connect(f'token={token_for(security)}&report_id={report.id}')
    # Should not raise even though this connection joined both a general
    # and a report-specific group.
    await communicator.disconnect()


# --- async DB helpers -------------------------------------------------

from asgiref.sync import sync_to_async


async def _acreate(factory_or_callable, *args, **kwargs):
    return await sync_to_async(factory_or_callable)(*args, **kwargs)


async def _arefresh(instance):
    await sync_to_async(instance.refresh_from_db)()


async def _acount(model):
    return await sync_to_async(model.objects.count)()
