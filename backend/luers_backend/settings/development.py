from .base import *


# Override cache to use DummyCache to avoid ratelimit system checks
# Redis cache (for ratelimiting, sessions, etc.)
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://localhost:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
DEBUG = True
CORS_ALLOW_ALL_ORIGINS = True

# Optional: log SQL queries for debugging
# LOGGING = {...}
ALLOWED_HOSTS = ['*']

# The frontend dev server (Vite + mkcert) proxies /api, /ws and /media to
# this backend over plain http and sets X-Forwarded-Proto: https on those
# requests, since it's the one actually terminating TLS. Without this,
# request.is_secure() (and so build_absolute_uri(), e.g. evidence file_url)
# would think every request is plain http even when a reviewer reached the
# app over https.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Tried switching this to channels_redis (matching production.py) so the
# emergency redesign's realtime dispatch would be testable across multiple
# worker processes locally too — reverted after live verification: this
# repo's dev stack (Windows + the installed redis-py/channels-redis
# versions) hits `redis.exceptions.TimeoutError: Timeout reading from
# localhost:6379` on essentially every WebSocket connect/disconnect here,
# breaking live updates outright. `manage.py runserver` is single-process
# anyway, so InMemoryChannelLayer's real limitation (no fan-out *across*
# processes) never actually applied to this dev setup — inherited
# unchanged from base.py below. Worth revisiting only if this dev
# environment moves off `runserver` onto something multi-process.

