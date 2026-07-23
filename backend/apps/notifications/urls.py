from django.urls import path
from apps.notifications.views import MessageListView, MessageCreateView

urlpatterns = [
    path('<uuid:report_id>/messages/', MessageListView.as_view(), name='message_list'),
    path('<uuid:report_id>/messages/create/', MessageCreateView.as_view(), name='message_create'),
]