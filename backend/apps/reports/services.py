from django.db import transaction
from django.utils import timezone
from apps.reports.models import Report, Evidence, ReportIdentity
from apps.core.choices import Action, Channel
from apps.audit.models import AuditLog
from apps.notifications.models import Notification
from apps.notifications.services import NotificationService
from apps.core.services import EncryptionService

class IdentityService:
    @staticmethod
    def create_identity(report, user):
        encrypted_ref = EncryptionService.generate_placeholder(user.id)
        return ReportIdentity.objects.create(
            report=report,
            encrypted_reporter_ref=encrypted_ref
        )
    
    @staticmethod
    def get_reporter(identity):
        decrypted = EncryptionService.decrypt(identity.encrypted_reporter_ref)
        if decrypted and decrypted.startswith('REF_'):
            return decrypted.replace('REF_', '')
        return None
    
    @staticmethod
    def identity_exists(report):
        return hasattr(report, 'identity')

class ReportClassifierService:
    @staticmethod
    def classify(category, description):
        return {
            'suggested_category': category,
            'confidence': 1.0,
            'priority_score': None
        }

class ReportService:
    @staticmethod
    @transaction.atomic
    def create_report(validated_data, user, ip_address=None):
        report = Report.objects.create(**validated_data)
        IdentityService.create_identity(report, user)
        
        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.CREATE,
            after_state={'category': report.category, 'status': report.status},
            ip_address=ip_address  # <-- Stores explicitly passed IP
        )
        
        classification = ReportClassifierService.classify(report.category, report.description)
        if report.metadata is None:
            report.metadata = {}
        report.metadata['classification'] = classification
        report.save(update_fields=['metadata'])
        
        Notification.objects.create(
            recipient=None,
            report=report,
            channel=Channel.WEBSOCKET,
            sent_at=timezone.now()
        )
        # Broadcast via WebSocket
        NotificationService.broadcast_report_created(report)

        # Send SMS and Email if assigned
        if report.assigned_to:
            if report.assigned_to.phone_number:
                NotificationService.dispatch(report, Channel.SMS, recipient=report.assigned_to)
            if report.assigned_to.email:
                NotificationService.dispatch(report, Channel.EMAIL, recipient=report.assigned_to)

        return report

    @staticmethod
    @transaction.atomic
    def update_status(report, new_status, user, ip_address=None):
        old_status = report.status
        if old_status == new_status:
            return {'error': 'Status already set to {}'.format(new_status)}
        report.status = new_status
        report.save(update_fields=['status', 'updated_at'])
        
        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.STATUS_UPDATE,
            before_state={'status': old_status},
            after_state={'status': new_status},
            ip_address=ip_address  # <-- Stores explicitly passed IP
        )
        
        Notification.objects.create(
            recipient=None,
            report=report,
            channel=Channel.WEBSOCKET,
            sent_at=timezone.now()
        )
        NotificationService.broadcast_report_updated(report)
        return {'status': new_status}

    @staticmethod
    @transaction.atomic
    def assign_report(report, assigned_to, user, ip_address=None):
        old_assigned = report.assigned_to
        report.assigned_to = assigned_to
        report.save(update_fields=['assigned_to', 'updated_at'])
        
        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.ASSIGN,
            before_state={'assigned_to': str(old_assigned.id) if old_assigned else None},
            after_state={'assigned_to': str(assigned_to.id)},
            ip_address=ip_address  # <-- Stores explicitly passed IP
        )
        
        if assigned_to:
            if assigned_to.phone_number:
                NotificationService.dispatch(report, Channel.SMS, recipient=assigned_to)
            if assigned_to.email:
                NotificationService.dispatch(report, Channel.EMAIL, recipient=assigned_to)
        return {'assigned_to': assigned_to.id}

    @staticmethod
    @transaction.atomic
    def add_evidence(report, file, file_type, user, ip_address=None):
        evidence = Evidence.objects.create(
            report=report,
            file=file,
            file_type=file_type
        )
        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.EVIDENCE_UPLOAD,
            after_state={'evidence_id': str(evidence.id)},
            ip_address=ip_address  # <-- Stores explicitly passed IP
        )
        return evidence