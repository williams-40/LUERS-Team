from django.urls import re_path
from apps.notifications.consumers import ReportConsumer

websocket_urlpatterns = [
    re_path(r'ws/reports/$', ReportConsumer.as_asgi()),
]
