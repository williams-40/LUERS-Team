import contextvars
import json
import logging

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('request_id', default='-')


class RequestIDFilter(logging.Filter):
    """Attaches the current request's correlation ID (set by RequestIDMiddleware) to every log record."""

    def filter(self, record):
        record.request_id = request_id_var.get()
        return True


class JSONFormatter(logging.Formatter):
    """Minimal structured formatter for log aggregation — no external dependency."""

    def format(self, record):
        payload = {
            'timestamp': self.formatTime(record, '%Y-%m-%dT%H:%M:%S%z'),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'request_id': getattr(record, 'request_id', '-'),
        }
        if record.exc_info:
            payload['exception'] = self.formatException(record.exc_info)
        return json.dumps(payload)
