from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """
    GET /healthz/
    Unauthenticated liveness/readiness check for load balancers and
    orchestrators. Verifies the database and cache are actually reachable,
    not just that the process is running.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        checks = {'database': self._check_database(), 'cache': self._check_cache()}
        healthy = all(checks.values())
        return Response(
            {'status': 'ok' if healthy else 'degraded', 'checks': checks},
            status=200 if healthy else 503,
        )

    def _check_database(self):
        try:
            connection.ensure_connection()
            return True
        except Exception:
            return False

    def _check_cache(self):
        try:
            cache.set('healthcheck', 'ok', timeout=5)
            return cache.get('healthcheck') == 'ok'
        except Exception:
            return False
