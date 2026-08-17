# apps/notifications/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.core.choices import Status
from apps.notifications.models import Message
from apps.reports.validators import validate_evidence_file

User = get_user_model()

class PingMessageSerializer(serializers.Serializer):
    """Schema for a ping message."""
    type = serializers.CharField(default='ping', read_only=True)

class StatusUpdateMessageSerializer(serializers.Serializer):
    """Schema for a status update message."""
    type = serializers.CharField(default='status_update', read_only=True)
    report_id = serializers.UUIDField(required=True)
    status = serializers.ChoiceField(choices=Status.choices, required=True)
    expected_updated_at = serializers.DateTimeField(required=False, allow_null=True)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)

class ChatMessageSerializer(serializers.Serializer):
    """Schema for a chat message."""
    type = serializers.CharField(default='chat_message', read_only=True)
    report_id = serializers.UUIDField(required=True)
    content = serializers.CharField(required=True, max_length=2000)

class WebSocketMessageSerializer(serializers.Serializer):
    """
    Main schema for all inbound WebSocket messages.
    """
    type = serializers.ChoiceField(choices=['ping', 'status_update', 'chat_message'], required=True)

    def validate(self, attrs):
        # `attrs` only carries fields this serializer itself declares (just
        # `type`) — report_id/status/content live on the raw payload, so the
        # nested serializers below must validate against `self.initial_data`,
        # not `attrs`, or every non-ping message fails as "field required".
        msg_type = attrs.get('type')
        if msg_type == 'ping':
            pass
        elif msg_type == 'status_update':
            status_serializer = StatusUpdateMessageSerializer(data=self.initial_data)
            status_serializer.is_valid(raise_exception=True)
            attrs.update(status_serializer.validated_data)
        elif msg_type == 'chat_message':
            chat_serializer = ChatMessageSerializer(data=self.initial_data)
            chat_serializer.is_valid(raise_exception=True)
            attrs.update(chat_serializer.validated_data)
        else:
            raise serializers.ValidationError(f"Unsupported message type: {msg_type}")
        return attrs


# REST Message Serializers
class MessageSerializer(serializers.ModelSerializer):
    """Serialize a message for list/detail views."""
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_id = serializers.UUIDField(source='sender.id', read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender_id', 'sender_username', 'content', 'attachment_url', 'created_at']

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment and request:
            return request.build_absolute_uri(obj.attachment.url)
        return None


class MessageCreateSerializer(serializers.ModelSerializer):
    """
    Create a new message. Returns the full message object.

    `content` is required UNLESS an `attachment` (voice note) is provided —
    a voice note stands on its own the same way a text message does. Reuses
    the same evidence-file validation (extension allowlist, size cap, magic-
    byte sniffing including the webm/weba audio-vs-video disambiguation) as
    report evidence uploads, see apps.reports.validators.
    """
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_id = serializers.UUIDField(source='sender.id', read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'content', 'attachment', 'attachment_url', 'sender_id', 'sender_username', 'created_at']
        read_only_fields = ['id', 'sender_id', 'sender_username', 'created_at']
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True, 'max_length': 2000},
            'attachment': {'required': False, 'write_only': True},
        }

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment and request:
            return request.build_absolute_uri(obj.attachment.url)
        return None

    def validate(self, attrs):
        content = attrs.get('content', '').strip()
        attachment = attrs.get('attachment')
        if not content and not attachment:
            raise serializers.ValidationError('A message needs text or a voice note.')
        if attachment:
            try:
                validate_evidence_file(attachment)
            except ValueError as e:
                raise serializers.ValidationError({'attachment': str(e)})
        return attrs

    def create(self, validated_data):
        report = self.context['report']
        user = self.context['request'].user
        return Message.objects.create(
            report=report,
            sender=user,
            content=validated_data.get('content', ''),
            attachment=validated_data.get('attachment'),
        )

    