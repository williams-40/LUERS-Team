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

