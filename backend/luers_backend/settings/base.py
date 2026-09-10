import os
from pathlib import Path
import environ

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Environment
env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

# SECURITY
SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Application definition
DJANGO_APPS = [
    # Must be first: channels patches `runserver` to serve ASGI (and thus
    # websockets) only when daphne is the very first entry in INSTALLED_APPS.
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
    "drf_spectacular",
    "django_ratelimit",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.reports",
    "apps.notifications",
    "apps.audit",
    "apps.core",
    "apps.dashboard",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

# Middleware
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.RequestIDMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "luers_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Database (PostgreSQL)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST"),
        "PORT": env("DB_PORT"),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-ug"
TIME_ZONE = "Africa/Kampala"
USE_I18N = True
USE_TZ = True

# Static & Media
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = env("MEDIA_ROOT", default=BASE_DIR / "media")

# Default primary key
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

# SimpleJWT
from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# CORS (tightened in production via settings override)
CORS_ALLOW_ALL_ORIGINS = True   # Override in production.py
# X-Cursor (ReportListView delta-fetch cursor) isn't in the CORS default-safelisted
# header set, so cross-origin JS can't read it without this.
CORS_EXPOSE_HEADERS = ["X-Cursor"]

# Channels & Redis
ASGI_APPLICATION = "luers_backend.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}


# Celery
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Static schedule (not django-celery-beat's DB-backed one — these SLA scan
# intervals aren't meant to be edited per-emergency from an admin UI).
# Requires a separate `celery -A luers_backend beat` process running
# alongside the worker — see backend README.
CELERY_BEAT_SCHEDULE = {
    "check-emergency-escalations": {
        "task": "apps.reports.tasks.check_emergency_escalations",
        "schedule": env.int("EMERGENCY_ESCALATION_SCAN_SECONDS", default=60),
    },
}

# Redis cache (for ratelimiting, sessions, etc.)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}
# drf-spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "LUERS API",
    "DESCRIPTION": "Lira University Emergency Reporting System",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SECURITY": [{"BearerAuth": []}],
    "SECURITY_DEFINITIONS": {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    },
}

# Twilio
TWILIO_ACCOUNT_SID = env("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = env("TWILIO_AUTH_TOKEN", default="")
TWILIO_PHONE_NUMBER = env("TWILIO_PHONE_NUMBER", default="")

# Mailtrap Email
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env("EMAIL_HOST", default="sandbox.smtp.mailtrap.io")
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=2525)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="LUERS <noreply@luers.com>")


# Used to build links in outbound emails (e.g. password reset) that point
# back at the SPA, which lives on a different origin than this API.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5175")

# Logging — console-readable here; production.py swaps the handler's
# formatter to the JSON one for log aggregation. RequestIDMiddleware
# populates request_id_var for the duration of each request.
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_id": {
            "()": "apps.core.log_utils.RequestIDFilter",
        },
    },
    "formatters": {
        "console": {
            "format": "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s",
        },
        "json": {
            "()": "apps.core.log_utils.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
            "filters": ["request_id"],
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}

# Notification task retries (apps/notifications/tasks.py) — overridden to 0
# in testing.py so tests fail fast instead of retrying against a Twilio/SMTP
# sandbox that isn't configured with real credentials.
NOTIFICATION_TASK_MAX_RETRIES = env.int("NOTIFICATION_TASK_MAX_RETRIES", default=3)
NOTIFICATION_TASK_RETRY_DELAY = env.int("NOTIFICATION_TASK_RETRY_DELAY", default=30)

# Emergency/panic dispatch SLAs (minutes), used to compute
# EmergencyDispatch.ack_deadline/response_deadline/resolution_deadline at
# creation time. Distinct from apps.dashboard.analytics.OVERDUE_HOURS, which
# stays a separate read-only reporting metric for the general report queue.
EMERGENCY_SLA_MINUTES = {
    "acknowledge": env.int("EMERGENCY_SLA_ACK_MINUTES", default=5),
    "respond": env.int("EMERGENCY_SLA_RESPOND_MINUTES", default=15),
    "resolve": env.int("EMERGENCY_SLA_RESOLVE_MINUTES", default=240),
}

# Sentry — no-op unless SENTRY_DSN is set, matching how Twilio/Mailtrap
# already degrade gracefully in this codebase without their own credentials.
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

# Disable rate limiting in development
if DEBUG:
    RATELIMIT_ENABLE = False
