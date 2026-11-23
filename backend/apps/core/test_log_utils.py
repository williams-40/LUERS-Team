import json
import logging
from apps.core.log_utils import JSONFormatter, RequestIDFilter, request_id_var


def make_record(msg='hello', exc_info=None):
    return logging.LogRecord(
        name='apps.test',
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=msg,
        args=None,
        exc_info=exc_info,
    )


def test_request_id_filter_attaches_current_context_id():
    token = request_id_var.set('req-123')
    try:
        record = make_record()
        assert RequestIDFilter().filter(record) is True
        assert record.request_id == 'req-123'
    finally:
        request_id_var.reset(token)


def test_request_id_filter_defaults_to_dash_outside_a_request():
    record = make_record()
    assert not hasattr(record, 'request_id')
    RequestIDFilter().filter(record)
    assert record.request_id == '-'


def test_json_formatter_produces_valid_json_with_expected_fields():
    record = make_record(msg='something happened')
    record.request_id = 'req-abc'
    payload = json.loads(JSONFormatter().format(record))

    assert payload['level'] == 'INFO'
    assert payload['logger'] == 'apps.test'
    assert payload['message'] == 'something happened'
    assert payload['request_id'] == 'req-abc'
    assert 'exception' not in payload


def test_json_formatter_defaults_request_id_when_missing():
    record = make_record()
    payload = json.loads(JSONFormatter().format(record))
    assert payload['request_id'] == '-'


def test_json_formatter_includes_exception_traceback():
    try:
        raise ValueError('boom')
    except ValueError:
        import sys
        record = make_record(msg='failed', exc_info=sys.exc_info())

    payload = json.loads(JSONFormatter().format(record))
    assert 'ValueError' in payload['exception']
    assert 'boom' in payload['exception']
