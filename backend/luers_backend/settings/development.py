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

