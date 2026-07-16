import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from apps.reports.serializers import ReportListSerializer

User = get_user_model()

class ReportConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get JWT token from query string
        query_string = self.scope['query_string'].decode()
        token = None
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = param.split('=')[1]
                break

        if not token:
            await self.close()
            return

        # Validate token and get user
        user = await self.get_user_from_token(token)
        if not user or user.role != 'security':
            await self.close()
            return

        self.user = user
        self.group_name = 'reports'

        # Join group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        # Handle incoming messages (e.g., ping/pong or status updates)
        # For now, we just ignore or echo
        pass

    async def report_created(self, event):
        """Send report creation notification to group."""
        report_data = event['data']
        await self.send(text_data=json.dumps({
            'type': 'report_created',
            'data': report_data
        }))

    async def report_updated(self, event):
        """Send report status update notification to group."""
        report_data = event['data']
        await self.send(text_data=json.dumps({
            'type': 'report_updated',
            'data': report_data
        }))

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None
