from .base import *

DEBUG = False
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# HSTS — base.py's SecurityMiddleware is already in MIDDLEWARE, this just
# turns the header on for production (never in dev, where SSL isn't in play).
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = "same-origin"

# Tight CORS (replace with your frontend domain)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# Structured JSON logs for aggregation — base.py's console-readable formatter
# is only meant for local dev.
LOGGING["handlers"]["console"]["formatter"] = "json"

# base.py's CACHES/CHANNEL_LAYERS default to in-process backends, which don't
# share state across multiple worker processes — silently breaking rate
# limiting and WebSocket group fan-out under any real multi-worker deployment.
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/1")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}