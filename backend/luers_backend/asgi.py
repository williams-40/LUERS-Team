import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'luers_backend.settings.development')

# This must happen before any imports that depend on Django apps
django_asgi_app = get_asgi_application()

# Now import the WebSocket routing (which imports consumers that use models)
from apps.notifications.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})
