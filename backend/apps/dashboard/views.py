from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from apps.reports.services import get_accessible_reports
from apps.accounts.permissions import IsAdminTier
from apps.dashboard.analytics import compute_dashboard_analytics


class DashboardSummaryView(APIView):
    """
    GET /api/v1/dashboard/summary/
    Returns aggregate counts, average response time — scoped to whatever
    the caller can see (get_accessible_reports): campus-wide for System
    Admin, department-wide for a department head, assigned-to-them only
    for a responder. Previously excluded Management/System Admin
    entirely (IsSecurity | IsICTAdmin only) — that was a gap, not a
    deliberate restriction; opened to the full admin tier.
    """
    permission_classes = [IsAuthenticated, IsAdminTier]

    def get(self, request):
        queryset = get_accessible_reports(request.user)

        total = queryset.count()
        # By department — replaces the old "by category" breakdown now
        # that department (not the retired Category enum) is how new
        # reports are classified.
        department_counts = (
            queryset.values(department_name=F('department__name')).annotate(count=Count('id'))
        )
        status_counts = queryset.values('status').annotate(count=Count('id'))
        urgency_counts = queryset.values('urgency').annotate(count=Count('id'))

        resolved = queryset.filter(status='resolved')
        avg_response_time = None
        if resolved.exists():
            avg = resolved.aggregate(avg_time=Avg(F('updated_at') - F('created_at')))
            if avg['avg_time']:
                avg_response_time = avg['avg_time'].total_seconds() / 3600  # hours

        return Response({
            'total': total,
            'department_counts': department_counts,
            'status_counts': status_counts,
            'urgency_counts': urgency_counts,
            'average_response_time_hours': avg_response_time,
        })


class DashboardTrendsView(APIView):
    """
    GET /api/v1/dashboard/trends/?days=30
    Returns daily report counts for the last N days (default 30, max
    180), scoped the same way as DashboardSummaryView.
    """
    permission_classes = [IsAuthenticated, IsAdminTier]

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except ValueError:
            days = 30
        days = max(1, min(days, 180))

        queryset = get_accessible_reports(request.user)
        since = timezone.now() - timedelta(days=days - 1)
        counts_by_date = dict(
            queryset.filter(created_at__gte=since)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(count=Count('id'))
            .values_list('day', 'count')
        )

        today = timezone.localdate()
        daily_counts = [
            {
                'date': (today - timedelta(days=offset)).isoformat(),
                'count': counts_by_date.get(today - timedelta(days=offset), 0),
            }
            for offset in range(days - 1, -1, -1)
        ]

        return Response({'daily_counts': daily_counts})


class DashboardAnalyticsView(APIView):
    """
    GET /api/v1/dashboard/analytics/
    Richer, additive operational metrics — see apps.dashboard.analytics
    for the (deliberately decomposed, one-function-per-metric) module
    this delegates to. Same scoping as the two views above.
    """
    permission_classes = [IsAuthenticated, IsAdminTier]

    def get(self, request):
        return Response(compute_dashboard_analytics(request.user))
