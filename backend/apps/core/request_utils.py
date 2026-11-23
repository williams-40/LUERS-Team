"""
Shared helpers for pulling audit-relevant context off an incoming request.
Previously get_client_ip was copy-pasted identically in apps/reports/views.py,
views_bulk.py, and views_feedback.py — consolidated here as the one version,
alongside get_user_agent for the same audit-log use case.
"""


def get_client_ip(request):
    """Best-effort real client IP, honoring a proxy's X-Forwarded-For."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


def get_user_agent(request):
    """Raw User-Agent header, truncated to the AuditLog.user_agent column width."""
    return request.META.get('HTTP_USER_AGENT', '')[:255]
