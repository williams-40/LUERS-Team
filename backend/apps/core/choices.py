from django.db import models

class Role(models.TextChoices):
    STUDENT = 'student', 'Student'
    STAFF = 'staff', 'Staff'
    SECURITY = 'security', 'Security Officer'
    ICT_ADMIN = 'ict_admin', 'ICT Admin'
    MANAGEMENT = 'management', 'Management / Escrow'
    SYSTEM_ADMIN = 'system_admin', 'System Admin'

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
    DEANONYMIZE = 'deanonymize', 'Deanonymize'   # Phase 2 backlog but include now
    SOFT_DELETE = 'soft_delete', 'Soft Delete'
    RESTORE = 'restore', 'Restore'

class SyncOrigin(models.TextChoices):
    LIVE = 'live', 'Live'
    SYNC = 'sync', 'Offline Sync'
