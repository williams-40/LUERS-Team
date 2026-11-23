"""
Richer dashboard analytics — additive to DashboardSummaryView/
DashboardTrendsView, not a replacement (see apps/dashboard/views.py).

Deliberately decomposed: one small pure function per metric, all taking
the caller's already-scoped `queryset` (from
apps.reports.services.get_accessible_reports) and returning just their
slice of the payload. `compute_dashboard_analytics` is the only function
that assembles them. Adding a new metric later means adding one function
here and one line in that assembly — nothing else changes.
"""
import re
from datetime import timedelta

from django.db.models import Avg, Count, F
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.core.choices import Action
from apps.reports.models import ReportFeedback
from apps.reports.services import get_accessible_reports

# Adjustable defaults, not a hard requirement from any spec — how long a
# still-open report can sit before it's considered overdue, per urgency.
OVERDUE_HOURS = {'panic': 4, 'normal': 48}

_STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
    'of', 'for', 'with', 'this', 'that', 'it', 'my', 'i', 'has', 'have', 'had', 'be', 'been',
    'near', 'by', 'from', 'as', 'so', 'if', 'not', 'no', 'some', 'there', 'their', 'they',
    'he', 'she', 'we', 'you', 'your', 'me', 'them', 'am', 'been', 'will', 'can', 'about',
}


def _status_breakdown(queryset):
    return {
        'open': queryset.filter(status__in=['new', 'acknowledged']).count(),
        'in_progress': queryset.filter(status='in_progress').count(),
        'resolved': queryset.filter(status='resolved').count(),
        'closed': queryset.filter(status='closed').count(),
    }


def _average_resolution_time_hours(queryset):
    resolved = queryset.filter(status='resolved')
    if not resolved.exists():
        return None
    avg = resolved.aggregate(avg_time=Avg(F('updated_at') - F('created_at')))
    return avg['avg_time'].total_seconds() / 3600 if avg['avg_time'] else None


def _average_assignment_time_hours(queryset):
    """Avg time from a report's creation to its earliest ASSIGN audit entry."""
    assigned_report_ids = list(
        AuditLog.objects.filter(report__in=queryset, action=Action.ASSIGN)
        .order_by('report_id', 'created_at')
        .distinct('report_id')
        .values_list('report_id', 'created_at')
    )
    if not assigned_report_ids:
        return None

    created_at_by_id = dict(queryset.filter(id__in=[rid for rid, _ in assigned_report_ids]).values_list('id', 'created_at'))
    deltas = [
        (assigned_at - created_at_by_id[report_id]).total_seconds()
        for report_id, assigned_at in assigned_report_ids
        if report_id in created_at_by_id
    ]
    if not deltas:
        return None
    return (sum(deltas) / len(deltas)) / 3600


_CLOSED_STATUSES = ['resolved', 'closed', 'cancelled', 'false_alarm']


def _overdue_count(queryset):
    """
    Split by urgency (not blended into one number) — a head seeing
    "Overdue: 3" couldn't previously tell three stale routine reports from
    three unattended emergencies. `total` is kept for callers that only
    want the headline figure.
    """
    now = timezone.now()
    open_reports = queryset.exclude(status__in=_CLOSED_STATUSES)
    counts = {
        urgency: open_reports.filter(urgency=urgency, created_at__lt=now - timedelta(hours=hours)).count()
        for urgency, hours in OVERDUE_HOURS.items()
    }
    counts['total'] = sum(counts.values())
    return counts


def _monthly_trend(queryset, months=12):
    since = timezone.now() - timedelta(days=30 * months)
    counts = (
        queryset.filter(created_at__gte=since)
        .annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(count=Count('id'))
        .order_by('month')
    )
    return [{'month': c['month'].strftime('%Y-%m'), 'count': c['count']} for c in counts]


def _responder_workload(queryset):
    workload = (
        queryset.exclude(status__in=['resolved', 'closed'])
        .exclude(assigned_to__isnull=True)
        .values('assigned_to__id', 'assigned_to__username')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    return [
        {'responder_id': str(w['assigned_to__id']), 'username': w['assigned_to__username'], 'open_count': w['count']}
        for w in workload
    ]


def _responder_performance(queryset):
    resolved = queryset.filter(status='resolved').exclude(assigned_to__isnull=True)
    performance = (
        resolved.values('assigned_to__id', 'assigned_to__username')
        .annotate(resolved_count=Count('id'), avg_resolution=Avg(F('updated_at') - F('created_at')))
        .order_by('-resolved_count')
    )
    return [
        {
            'responder_id': str(p['assigned_to__id']),
            'username': p['assigned_to__username'],
            'resolved_count': p['resolved_count'],
            'average_resolution_time_hours': (
                p['avg_resolution'].total_seconds() / 3600 if p['avg_resolution'] else None
            ),
        }
        for p in performance
    ]


def _top_keywords(queryset, limit=10):
    """
    Lightweight, dependency-free word-frequency count — explicitly not
    NLP/AI (matches this project's existing "no AI yet" stance). A real
    classifier can replace this function alone without touching anything
    else in this module.
    """
    counts = {}
    for description in queryset.values_list('description', flat=True):
        for word in re.findall(r"[a-zA-Z']+", (description or '').lower()):
            if len(word) < 3 or word in _STOPWORDS:
                continue
            counts[word] = counts.get(word, 0) + 1
    top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{'keyword': word, 'count': count} for word, count in top]


def _average_feedback_rating(queryset):
    result = ReportFeedback.objects.filter(report__in=queryset).aggregate(avg=Avg('rating'), count=Count('id'))
    return {'average_rating': result['avg'], 'feedback_count': result['count']}


def compute_dashboard_analytics(user):
    queryset = get_accessible_reports(user)
    return {
        'total': queryset.count(),
        **_status_breakdown(queryset),
        'average_assignment_time_hours': _average_assignment_time_hours(queryset),
        'average_resolution_time_hours': _average_resolution_time_hours(queryset),
        'overdue': _overdue_count(queryset),
        'urgency_counts': list(queryset.values('urgency').annotate(count=Count('id'))),
        'monthly_trend': _monthly_trend(queryset),
        'responder_workload': _responder_workload(queryset),
        'responder_performance': _responder_performance(queryset),
        'top_keywords': _top_keywords(queryset),
        'feedback': _average_feedback_rating(queryset),
    }
