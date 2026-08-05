from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from apps.reports.models import Report, Evidence, ReportIdentity, Department
from apps.core.choices import Action, Channel, SyncOrigin
from apps.audit.models import AuditLog
from apps.notifications.models import Notification, Message
from apps.notifications.services import NotificationService
from apps.core.services import EncryptionService
from apps.reports.routing import DepartmentRoutingService, get_confidence_tier
from apps.accounts.models import User


class ConflictError(APIException):
    """Exception raised when a report has been modified since last fetch."""
    status_code = 409
    default_detail = 'The report has been modified since you last fetched it. Please refresh and try again.'
    default_code = 'conflict'


class IdentityService:
    @staticmethod
    def create_identity(report, user):
        encrypted_ref = EncryptionService.generate_placeholder(user.id)
        return ReportIdentity.objects.create(
            report=report,
            encrypted_reporter_ref=encrypted_ref,
            reporter_hash=EncryptionService.hash_for_lookup(user.id),
        )

    @staticmethod
    def get_reporter(identity):
        decrypted = EncryptionService.decrypt(identity.encrypted_reporter_ref)
        if decrypted:
            if decrypted.startswith('REF_'):
                return decrypted.replace('REF_', '')
            elif decrypted.startswith('PLACEHOLDER_'):
                return decrypted.replace('PLACEHOLDER_', '')
        return None

    @staticmethod
    def is_owner(identity, user):
        """
        Whether `user` is the reporter behind `identity`, checked via the
        one-way reporter_hash (never decrypts encrypted_reporter_ref).
        """
        if identity is None or not identity.reporter_hash:
            return False
        return identity.reporter_hash == EncryptionService.hash_for_lookup(user.id)

    @staticmethod
    def identity_exists(report):
        return hasattr(report, 'identity')

    @staticmethod
    def reveal_identity(report, actor, ip_address=None, sync_origin=SyncOrigin.LIVE):
        """
        Decrypt a report's reporter identity for the Management/Escrow role
        and record a DEANONYMIZE audit entry. Raises APIException(404-style)
        via the caller if no identity exists.
        """
        identity = ReportIdentity.objects.filter(report=report).first()
        if identity is None:
            return None

        user_id = IdentityService.get_reporter(identity)
        reporter = None
        if user_id:
            reporter = User.objects.filter(id=user_id).first()

        after_state = {
            'revealed_user_id': str(reporter.id) if reporter else user_id,
            'revealed_username': reporter.username if reporter else None,
        }

        AuditLog.objects.create(
            report=report,
            actor=actor,
            action=Action.DEANONYMIZE,
            after_state=after_state,
            ip_address=ip_address,
            sync_origin=sync_origin,
        )

        return reporter


class ReportClassifierService:
    @staticmethod
    def classify(category, description):
        return {
            'suggested_category': category,
            'confidence': 1.0,
            'priority_score': None
        }


class MessageService:
    """Service for sending messages and broadcasting via WebSocket."""
    @staticmethod
    def send_message(report, user, content, sync_origin=SyncOrigin.SYNC):
        message = Message.objects.create(
            report=report,
            sender=user,
            content=content
        )

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'report_{report.id}',
            {
                'type': 'chat_message',
                'data': {
                    'id': str(message.id),
                    'sender': user.username,
                    'content': message.content,
                    'created_at': message.created_at.isoformat(),
                }
            }
        )

        return message


class ReportService:
    @staticmethod
    @transaction.atomic
    def create_report(validated_data, user, ip_address=None, sync_origin=SyncOrigin.LIVE):
        # Idempotency
        idempotency_key = validated_data.pop('idempotency_key', None)
        client_created_at = validated_data.pop('client_created_at', None)

        # Department is now selected directly by the reporter (Phase 14 —
        # replaces the old fixed-Category-with-hardcoded-routing scheme).
        # "Other" gets a shot at keyword-based auto-routing; everything
        # else is used exactly as chosen.
        department = validated_data.get('department')
        department_source = 'user_selected'
        routing_result = None
        tier = None

        if department and department.name == 'Other':
            routing_result = DepartmentRoutingService().classify(validated_data.get('description', ''))
            tier = get_confidence_tier(routing_result.confidence) if routing_result.department else 'low'
            if tier == 'high':
                department = routing_result.department
                validated_data['department'] = department
                department_source = 'auto_inferred'
            else:
                department_source = 'unclassified_pending_review'

        if idempotency_key:
            existing = Report.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        report = Report.objects.create(
            **validated_data,
            idempotency_key=idempotency_key,
            client_created_at=client_created_at,
        )
        IdentityService.create_identity(report, user)

        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.CREATE,
            after_state={
                'department': department.name if department else None,
                'department_source': department_source,
                'status': report.status,
            },
            ip_address=ip_address,
            client_timestamp=client_created_at,
            sync_origin=sync_origin,
        )

        metadata_updates = {'classification': ReportClassifierService.classify(None, report.description)}
        if routing_result is not None and tier == 'high':
            AuditLog.objects.create(
                report=report,
                actor=user,
                action=Action.AUTO_ROUTE,
                after_state={
                    'department': routing_result.department.name,
                    'confidence': routing_result.confidence,
                    'strategy': routing_result.strategy,
                    'matched_keywords': routing_result.matched_keywords,
                },
                ip_address=ip_address,
                sync_origin=sync_origin,
            )
        elif routing_result is not None and tier == 'medium':
            metadata_updates['routing_suggestion'] = {
                'suggested_department': routing_result.department.name,
                'confidence': routing_result.confidence,
                'matched_keywords': routing_result.matched_keywords,
            }
            AuditLog.objects.create(
                report=report,
                actor=user,
                action=Action.ROUTING_SUGGESTION,
                after_state={
                    'suggested_department': routing_result.department.name,
                    'confidence': routing_result.confidence,
                    'strategy': routing_result.strategy,
                    'matched_keywords': routing_result.matched_keywords,
                },
                ip_address=ip_address,
                sync_origin=sync_origin,
            )

        report.metadata = {**(report.metadata or {}), **metadata_updates}
        report.save(update_fields=['metadata'])

        Notification.objects.create(
            recipient=None,
            report=report,
            channel=Channel.WEBSOCKET,
            sent_at=timezone.now()
        )
        # Deferred to on_commit: this runs inside @transaction.atomic, and the
        # in-memory channel layer delivers to listening sockets fast enough
        # that a client refetching in response to the broadcast can lose the
        # race against this transaction's own commit and read stale/missing
        # data. Broadcasting only after commit closes that window.
        transaction.on_commit(lambda: NotificationService.broadcast_report_created(report))

        # Send SMS and Email if assigned
        if report.assigned_to:
            if report.assigned_to.phone_number:
                NotificationService.dispatch(report, Channel.SMS, recipient=report.assigned_to)
            if report.assigned_to.email:
                NotificationService.dispatch(report, Channel.EMAIL, recipient=report.assigned_to)

        # --- Notify department heads/members ---
        ReportService._notify_department(report, department)

        return report

    @staticmethod
    def _notify_department(report, department):
        """
        Send notifications to department head and members when a report is created.
        """
        if not department:
            return

        recipients = set()
        if department.head:
            recipients.add(department.head)
        for member in department.members.all():
            recipients.add(member)

        for user in recipients:
            Notification.objects.create(
                recipient=user,
                report=report,
                channel=Channel.WEBSOCKET,
                sent_at=timezone.now()
            )

    @staticmethod
    @transaction.atomic
    def update_status(report, new_status, user, ip_address=None, expected_updated_at=None,
                      client_timestamp=None, sync_origin=SyncOrigin.LIVE):
        ReportService._check_version(report, expected_updated_at)

        old_status = report.status
        if old_status == new_status:
            return {'error': f'Status already set to {new_status}'}
        report.status = new_status
        report.save(update_fields=['status', 'updated_at'])

        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.STATUS_UPDATE,
            before_state={'status': old_status},
            after_state={'status': new_status},
            ip_address=ip_address,
            client_timestamp=client_timestamp,
            sync_origin=sync_origin,
        )

        Notification.objects.create(
            recipient=None,
            report=report,
            channel=Channel.WEBSOCKET,
            sent_at=timezone.now()
        )
        transaction.on_commit(lambda: NotificationService.broadcast_report_updated(report))
        return {'status': new_status}

    @staticmethod
    @transaction.atomic
    def assign_report(report, assigned_to, user, ip_address=None, expected_updated_at=None,
                      client_timestamp=None, sync_origin=SyncOrigin.LIVE):
        ReportService._check_version(report, expected_updated_at)

        old_assigned = report.assigned_to
        report.assigned_to = assigned_to
        report.save(update_fields=['assigned_to', 'updated_at'])

        AuditLog.objects.create(
            report=report,
            actor=user,
            action=Action.ASSIGN,
            before_state={'assigned_to': str(old_assigned.id) if old_assigned else None},
            after_state={'assigned_to': str(assigned_to.id)},
            ip_address=ip_address,
            client_timestamp=client_timestamp,
            sync_origin=sync_origin,
        )

        if assigned_to:
            if assigned_to.phone_number:
                NotificationService.dispatch(report, Channel.SMS, recipient=assigned_to)
            if assigned_to.email:
                NotificationService.dispatch(report, Channel.EMAIL, recipient=assigned_to)

        # Unlike update_status, this broadcast was missing entirely — an
        # assignment never reached the live queue/dashboard/report-detail
        # views until a manual refresh.
        transaction.on_commit(lambda: NotificationService.broadcast_report_updated(report))
        return {'assigned_to': assigned_to.id}

    @staticmethod
    @transaction.atomic
    def transfer_department(report, new_department, actor, reason=None, ip_address=None, sync_origin=SyncOrigin.LIVE):
        """
        Routine re-routing correction by the report's current department
        head (or System Admin) — distinct from `escalate`, which is for
        exceptional situations rather than "this actually belongs to ICT."
        Clears any existing responder assignment since it doesn't carry
        across departments.
        """
        old_department = report.department
        old_assigned = report.assigned_to
        report.department = new_department
        report.assigned_to = None
        report.save(update_fields=['department', 'assigned_to', 'updated_at'])

        AuditLog.objects.create(
            report=report,
            actor=actor,
            action=Action.DEPARTMENT_TRANSFER,
            before_state={
                'department': old_department.name if old_department else None,
                'assigned_to': str(old_assigned.id) if old_assigned else None,
            },
            after_state={'department': new_department.name, 'reason': reason},
            ip_address=ip_address,
            sync_origin=sync_origin,
        )

        ReportService._notify_department(report, new_department)
        transaction.on_commit(lambda: NotificationService.broadcast_report_updated(report))
        return report

    @staticmethod
    @transaction.atomic
    def escalate(report, actor, reason=None, ip_address=None, sync_origin=SyncOrigin.LIVE):
        """
        For genuinely exceptional situations needing admin intervention —
        NOT for routine department-routing corrections, which use
        `transfer_department` instead. Notifies every System Admin.
        """
        AuditLog.objects.create(
            report=report,
            actor=actor,
            action=Action.ESCALATE,
            after_state={'reason': reason},
            ip_address=ip_address,
            sync_origin=sync_origin,
        )

        for admin in User.objects.filter(role__permissions__slug='view_all_reports', is_active=True).distinct():
            Notification.objects.create(
                recipient=admin,
                report=report,
                channel=Channel.WEBSOCKET,
                sent_at=timezone.now(),
            )
        return report

    @staticmethod
    @transaction.atomic
    def add_evidence(report, file, file_type, user, ip_address=None,
                     client_timestamp=None, sync_origin=SyncOrigin.LIVE):
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
            ip_address=ip_address,
            client_timestamp=client_timestamp,
            sync_origin=sync_origin,
        )
        return evidence

    @staticmethod
    @transaction.atomic
    def soft_delete(report, actor, ip_address=None, sync_origin=SyncOrigin.LIVE):
        report.deleted_at = timezone.now()
        report.save(update_fields=['deleted_at', 'updated_at'])

        AuditLog.objects.create(
            report=report,
            actor=actor,
            action=Action.SOFT_DELETE,
            before_state={'deleted_at': None},
            after_state={'deleted_at': report.deleted_at.isoformat()},
            ip_address=ip_address,
            sync_origin=sync_origin,
        )
        return report

    @staticmethod
    @transaction.atomic
    def restore(report, actor, ip_address=None, sync_origin=SyncOrigin.LIVE):
        old_deleted_at = report.deleted_at
        report.deleted_at = None
        report.save(update_fields=['deleted_at', 'updated_at'])

        AuditLog.objects.create(
            report=report,
            actor=actor,
            action=Action.RESTORE,
            before_state={'deleted_at': old_deleted_at.isoformat() if old_deleted_at else None},
            after_state={'deleted_at': None},
            ip_address=ip_address,
            sync_origin=sync_origin,
        )
        return report

    @staticmethod
    def _check_version(report, expected_updated_at):
        if expected_updated_at is not None:
            if timezone.is_naive(expected_updated_at):
                expected = timezone.make_aware(expected_updated_at)
            else:
                expected = expected_updated_at
            if report.updated_at != expected:
                raise ConflictError(
                    "The report has been modified since you last fetched it. "
                    "Please refresh and try again."
                )


# ============================================================
# Department Access Helper (Phase 6)
# ============================================================

def filter_reports(queryset, params):
    """
    Shared status/category/urgency/search filtering for the queue list and
    export views. `search` is a plain icontains OR across description,
    custom_department, department name, and assigned officer username —
    deliberately excludes ReportIdentity (encrypted reporter identity must
    never be searchable in plaintext) and category/status/urgency (already
    exact-match filterable above; substring-matching them too would be
    redundant and could mislead officers about what search actually does).

    icontains can't use a plain btree index, so this scans on `description`
    for now — fine at this app's current scale. A pg_trgm GIN index would
    accelerate it but needs a new Postgres extension + migration; revisit
    only if EXPLAIN ANALYZE ever shows it matters.
    """
    status = params.get('status')
    category = params.get('category')
    department = params.get('department')
    urgency = params.get('urgency')
    search = params.get('search')
    if status:
        queryset = queryset.filter(status=status)
    if category:
        queryset = queryset.filter(category=category)
    if department:
        queryset = queryset.filter(department_id=department)
    if urgency:
        queryset = queryset.filter(urgency=urgency)
    if search:
        queryset = queryset.filter(
            Q(description__icontains=search)
            | Q(custom_department__icontains=search)
            | Q(department__name__icontains=search)
            | Q(assigned_to__username__icontains=search)
        ).distinct()
    return queryset


def get_accessible_reports(user, include_deleted=False):
    """
    Return a QuerySet of reports the user is allowed to see.

    As of Phase 14, visibility is Department-based rather than tied to a
    fixed account Role — "Department Head" and "Department Responder"
    (member) are their own axis (any user can be either, see
    `apps.reports.serializers_department`), and a report's classification
    IS its department (the old fixed Category enum is retired for new
    reports — see `apps.reports.routing`):
    - System Admin sees everything, unconditionally.
    - A Department Head sees every report in the department(s) they head
      ("Department Heads... View every report assigned to their
      department").
    - A Department Responder (member, non-head) sees only reports
      *assigned to them* — even within their own department — not every
      report their department owns ("Responders... should only View
      reports assigned to them... not... reports assigned to other
      responders").
    - Everyone else (students/staff, the actual reporters) sees only
      their own non-anonymous reports.

    Soft-deleted reports (deleted_at set) are excluded by default for
    everyone, including System Admin — they're only visible via
    ReportDeletedListView (`include_deleted=True`), which is gated on
    CanDeleteReport, so a report being soft-deleted doesn't leak into the
    triage queue, dashboards, or search just because the viewer is an admin.
    """
    if user.has_permission('view_all_reports'):
        queryset = Report.objects.all()
    else:
        dept_as_head = Department.objects.filter(head=user)
        if dept_as_head.exists():
            queryset = Report.objects.filter(department__in=dept_as_head)
        else:
            dept_as_member = user.department_members.all()
            if dept_as_member.exists():
                queryset = Report.objects.filter(department__in=dept_as_member, assigned_to=user)
            else:
                # Students/staff: only own non‑anonymous reports
                reporter_hash = EncryptionService.hash_for_lookup(user.id)
                identities = ReportIdentity.objects.filter(reporter_hash=reporter_hash)
                report_ids = identities.values_list('report_id', flat=True)
                queryset = Report.objects.filter(id__in=report_ids, is_anonymous=False)

    if include_deleted:
        return queryset
    return queryset.filter(deleted_at__isnull=True)


def get_accessible_audit_logs(user):
    """
    Audit-log analog of `get_accessible_reports`, same Department Head /
    Responder axis: System Admin sees every entry; a Department Head sees
    every entry for reports in the department(s) they head (full
    oversight, not just their own actions); a Responder (member, non-head)
    sees only entries where *they* are the actor; everyone else sees
    nothing (the audit log endpoints are IsAdminTier-ish gated anyway, but
    this stays safe if ever called for a plain reporter).
    """
    if user.has_permission('view_all_reports'):
        return AuditLog.objects.all()

    dept_as_head = Department.objects.filter(head=user)
    if dept_as_head.exists():
        accessible_reports = Report.objects.filter(department__in=dept_as_head)
        return AuditLog.objects.filter(report__in=accessible_reports)

    dept_as_member = user.department_members.all()
    if dept_as_member.exists():
        return AuditLog.objects.filter(actor=user)

    return AuditLog.objects.none()


def is_department_head_or_system_admin(user, report):
    """
    Who may assign/reassign/transfer a report, or receive its escalation:
    the report's own department head, or System Admin (any department).
    """
    if user.has_permission('view_all_reports'):
        return True
    return bool(report.department_id and report.department.head_id == user.id)


def is_department_member_or_head(user, department):
    """Whether `user` is eligible to be assigned a report in `department` — its head or one of its members."""
    if department is None:
        return False
    if department.head_id == user.id:
        return True
    return department.members.filter(id=user.id).exists()