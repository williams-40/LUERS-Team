from django.db import models

class Role(models.TextChoices):
    STUDENT = 'student', 'Student'
    STAFF = 'staff', 'Staff'
    RESPONDER = 'responder', 'Responder'
    DEPARTMENT_HEAD = 'department_head', 'Department Head'
    SYSTEM_ADMIN = 'system_admin', 'System Admin'
    # security/ict_admin/management retired entirely (2026-08-17 UI-driven
    # cleanup) — their Role rows are deleted (accounts/0013), not just
    # deactivated. See apps.core.factories for how the test suite still
    # exercises their old permission shapes without a seeded row.

class Category(models.TextChoices):
    THEFT = 'theft', 'Theft'
    ASSAULT = 'assault', 'Assault'
    MEDICAL = 'medical', 'Medical'
    FIRE = 'fire', 'Fire'
    HARASSMENT_GBV = 'harassment_gbv', 'Harassment / GBV'
    ACADEMIC = 'academic', 'Academic'  
    OTHER = 'other', 'Other'

class Urgency(models.TextChoices):
    PANIC = 'panic', 'Panic'
    NORMAL = 'normal', 'Normal'

class Status(models.TextChoices):
    NEW = 'new', 'New'
    ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
    IN_PROGRESS = 'in_progress', 'In Progress'
    RESOLVED = 'resolved', 'Resolved'
    CLOSED = 'closed', 'Closed'
    CANCELLED = 'cancelled', 'Cancelled'
    FALSE_ALARM = 'false_alarm', 'False Alarm'

class EmergencyType(models.TextChoices):
    SECURITY = 'security', 'Security / Threat'
    MEDICAL = 'medical', 'Medical Emergency'
    FIRE = 'fire', 'Fire'
    ACCIDENT = 'accident', 'Accident'
    OTHER = 'other', 'Other'

class FileType(models.TextChoices):
    IMAGE = 'image', 'Image'
    VIDEO = 'video', 'Video'
    AUDIO = 'audio', 'Audio'
    OTHER = 'other', 'Other'

class Channel(models.TextChoices):
    WEBSOCKET = 'websocket', 'WebSocket'
    SMS = 'sms', 'SMS'
    EMAIL = 'email', 'Email'

class Action(models.TextChoices):
    CREATE = 'create', 'Create'
    STATUS_UPDATE = 'status_update', 'Status Update'
    ASSIGN = 'assign', 'Assign'
    EVIDENCE_UPLOAD = 'evidence_upload', 'Evidence Upload'
    SOFT_DELETE = 'soft_delete', 'Soft Delete'
    RESTORE = 'restore', 'Restore'
    AUTO_ROUTE = 'auto_route', 'Auto Route'
    ROUTING_SUGGESTION = 'routing_suggestion', 'Routing Suggestion'
    FEEDBACK_REQUESTED = 'feedback_requested', 'Feedback Requested'
    SUBMIT_FEEDBACK = 'submit_feedback', 'Submit Feedback'
    VIEW_FEEDBACK = 'view_feedback', 'View Feedback'
    RESPONDER_CREATED = 'responder_created', 'Responder Created'
    HEAD_CREATED = 'head_created', 'Head Created'
    ACCOUNT_CREATED = 'account_created', 'Account Created'
    ROLE_CHANGED = 'role_changed', 'Role Changed'
    ACCOUNT_ACTIVATED = 'account_activated', 'Account Activated'
    ACCOUNT_DEACTIVATED = 'account_deactivated', 'Account Deactivated'
    EMERGENCY_ACKNOWLEDGED = 'emergency_acknowledged', 'Emergency Acknowledged'
    EMERGENCY_RESPONDING = 'emergency_responding', 'Emergency Responding'
    EMERGENCY_ARRIVED = 'emergency_arrived', 'Emergency Arrived'
    EMERGENCY_ESCALATED = 'emergency_escalated', 'Emergency Escalated'
    EMERGENCY_CANCELLED = 'emergency_cancelled', 'Emergency Cancelled'
    EMERGENCY_FALSE_ALARM = 'emergency_false_alarm', 'Emergency Marked False Alarm'

class SyncOrigin(models.TextChoices):
    LIVE = 'live', 'Live'
    SYNC = 'sync', 'Offline Sync'
