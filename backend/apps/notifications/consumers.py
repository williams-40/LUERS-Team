import json
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.reports.serializers import ReportListSerializer
from apps.reports.services import ReportService, IdentityService
from apps.core.choices import SyncOrigin
from apps.reports.models import Report
from apps.notifications.models import Message
from apps.notifications.serializers import WebSocketMessageSerializer

User = get_user_model()

class ReportConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get JWT token and optional report_id from query string
        query_string = self.scope['query_string'].decode()
        token = None
        report_id = None
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = param.split('=')[1]
            elif param.startswith('report_id='):
                report_id = param.split('=')[1]

        if not token:
            await self.close()
            return

        # Validate token and get user
        user = await self.get_user_from_token(token)
        if not user or user.role not in ['security', 'ict_admin', 'management']:
            await self.close()
            return

        self.user = user
        self.groups = ['reports']  # Always join the general group
        self.report_groups = []    # Track report-specific groups

        # Join general group
        await self.channel_layer.group_add('reports', self.channel_name)

        # If a report_id is provided, check access and join if authorized
        if report_id:
            if await self._can_access_report(user, report_id):
                group_name = f'report_{report_id}'
                self.report_groups.append(group_name)
                await self.channel_layer.group_add(group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        # Leave general group and all report groups
        await self.channel_layer.group_discard('reports', self.channel_name)
        for group in self.report_groups:
            await self.channel_layer.group_discard(group, self.channel_name)

    @database_sync_to_async
    def _can_access_report(self, user, report_id):
        """Check if a user has permission to access a specific report."""
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return False

        # Admin roles have full access
        if user.role in ['security', 'ict_admin', 'management']:
            return True

        # Check if user is the reporter (non-anonymous only)
        if not report.is_anonymous:
            from apps.reports.models import ReportIdentity
            try:
                identity = ReportIdentity.objects.get(report=report)
                reporter_id = IdentityService.get_reporter(identity)
                if reporter_id and str(user.id) == reporter_id:
                    return True
            except ReportIdentity.DoesNotExist:
                pass

        # Check if user is the assigned officer
        if report.assigned_to and report.assigned_to.id == user.id:
            return True

        return False

    @database_sync_to_async
    def _get_report_and_check_access(self, user, report_id):
        """Fetch report and check access in one DB call."""
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return None, False

        if not self._can_access_report(user, report_id):
            return report, False
        return report, True

    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages using a typed schema.
        """
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
            return

        serializer = WebSocketMessageSerializer(data=data)
        if not serializer.is_valid():
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Validation error',
                'errors': serializer.errors
            }))
            return

        validated_data = serializer.validated_data
        msg_type = validated_data['type']

        if msg_type == 'ping':
            await self.send(text_data=json.dumps({
                'type': 'pong',
                'timestamp': self.scope['server'][1] if self.scope.get('server') else ''
            }))

        elif msg_type == 'status_update':
            report_id = validated_data['report_id']
            new_status = validated_data['status']
            expected_updated_at = validated_data.get('expected_updated_at')
            client_timestamp = validated_data.get('client_timestamp')

            # Only security can update status
            if self.user.role != 'security':
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Only security officers can update status'
                }))
                return

            # Check access to the report
            report, has_access = await self._get_report_and_check_access(self.user, report_id)
            if not has_access:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'You do not have permission to update this report'
                }))
                return

            ip_address = self.scope.get('client', [''])[0] if self.scope.get('client') else None

            result = await database_sync_to_async(ReportService.update_status)(
                report,
                new_status,
                self.user,
                ip_address=ip_address,
                expected_updated_at=expected_updated_at,
                client_timestamp=client_timestamp,
                sync_origin=SyncOrigin.LIVE
            )

            if 'error' in result:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': result['error']
                }))
            else:
                serialized_report = await database_sync_to_async(
                    lambda: ReportListSerializer(report, context={'request': None}).data
                )()
                # Broadcast to general group and report-specific group
                await self.channel_layer.group_send(
                    'reports',
                    {'type': 'report_updated', 'data': serialized_report}
                )
                await self.channel_layer.group_send(
                    f'report_{report_id}',
                    {'type': 'report_updated', 'data': serialized_report}
                )

        elif msg_type == 'chat_message':
            report_id = validated_data['report_id']
            content = validated_data['content']

            # Check access to the report
            report, has_access = await self._get_report_and_check_access(self.user, report_id)
            if not has_access:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'You do not have permission to send messages for this report'
                }))
                return

            # Create the message
            message = await database_sync_to_async(Message.objects.create)(
                report=report,
                sender=self.user,
                content=content
            )

            # Broadcast to the report-specific group only
            await self.channel_layer.group_send(
                f'report_{report_id}',
                {
                    'type': 'chat_message',
                    'data': {
                        'id': str(message.id),
                        'sender': self.user.username,
                        'content': message.content,
                        'created_at': message.created_at.isoformat(),
                    }
                }
            )

    async def report_created(self, event):
        """Broadcast new report creation to the general group (dashboard)."""
        await self.send(text_data=json.dumps({
            'type': 'report_created',
            'data': event['data']
        }))

    async def report_updated(self, event):
        """Broadcast report updates to the general group (dashboard)."""
        await self.send(text_data=json.dumps({
            'type': 'report_updated',
            'data': event['data']
        }))

    async def chat_message(self, event):
        """Broadcast a chat message to the report-specific group."""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'data': event['data']
        }))

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None