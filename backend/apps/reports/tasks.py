from celery import shared_task
from django.utils import timezone
from apps.core.choices import Urgency
from apps.reports.models import EmergencyDispatch


def _relevant_deadline(dispatch):
    """Whichever SLA deadline currently applies, based on how far the
    emergency has actually progressed — not always ack_deadline."""
    if dispatch.acknowledged_at is None:
        return dispatch.ack_deadline
    if dispatch.responding_at is None:
        return dispatch.response_deadline
    return dispatch.resolution_deadline


@shared_task
def check_emergency_escalations():
    """
    Runs on a fixed interval (see CELERY_BEAT_SCHEDULE) — scans every open
    panic report's EmergencyDispatch for a missed SLA deadline and
    escalates it via the same EmergencyDispatchService.escalate used for
    manual escalation (actor=None marks it automatic in the audit trail).

    Idempotent per deadline: `last_escalated_at` is only ever compared
    against, and then set past, the specific deadline that triggered it —
    a still-missed deadline doesn't re-escalate on every tick, but a
    *later* deadline (e.g. response_deadline, once ack_deadline was
    already escalated for) correctly triggers a further escalation.
    """
    # Imported here, not at module level, to avoid a services.py <-> tasks.py
    # import cycle (services.py doesn't need to know about this task).
    from apps.reports.services import EmergencyDispatchService, ACTIVE_PANIC_STATUSES

    now = timezone.now()
    candidates = EmergencyDispatch.objects.select_related('report').filter(
        report__urgency=Urgency.PANIC,
        report__status__in=ACTIVE_PANIC_STATUSES,
    )

    escalated_report_ids = []
    for dispatch in candidates:
        deadline = _relevant_deadline(dispatch)
        if deadline is None or now < deadline:
            continue
        if dispatch.last_escalated_at is not None and dispatch.last_escalated_at >= deadline:
            continue
        EmergencyDispatchService.escalate(dispatch.report, actor=None)
        escalated_report_ids.append(str(dispatch.report_id))

    return {'escalated': escalated_report_ids}
