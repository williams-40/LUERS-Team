import uuid
from apps.core.log_utils import request_id_var


class RequestIDMiddleware:
    """
    Assigns each request a correlation ID (reusing an inbound X-Request-ID
    from an upstream load balancer if present), makes it available to the
    logging formatters for the request's duration, and echoes it back in
    the response header so a client/support ticket can reference it.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID') or uuid.uuid4().hex
        request.request_id = request_id
        token = request_id_var.set(request_id)
        try:
            response = self.get_response(request)
        finally:
            request_id_var.reset(token)
        response['X-Request-ID'] = request_id
        return response