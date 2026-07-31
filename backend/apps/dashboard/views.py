from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from apps.reports.models import Report
from apps.accounts.permissions import IsSecurity, IsICTAdmin

class DashboardSummaryView(APIView):
    """
    GET /api/v1/dashboard/summary/
    Returns aggregate counts, average response time.
    Only Security and ICT Admin can access.
    """
    permission_classes = [IsAuthenticated, IsSecurity | IsICTAdmin]

    def get(self, request):
        # Total reports
        total = Report.objects.count()
        # By category
        category_counts = Report.objects.values('category').annotate(count=Count('id'))
        # By status
        status_counts = Report.objects.values('status').annotate(count=Count('id'))
        # By urgency
        urgency_counts = Report.objects.values('urgency').annotate(count=Count('id'))
        # Average response time: time from created to assigned (if assigned)
        # For simplicity, we use created_at to updated_at for resolved reports.
        resolved = Report.objects.filter(status='resolved')
        avg_response_time = None
        if resolved.exists():
            # Calculate average time difference in hours between created_at and updated_at
            avg = resolved.aggregate(avg_time=Avg(F('updated_at') - F('created_at')))
            if avg['avg_time']:
                avg_response_time = avg['avg_time'].total_seconds() / 3600  # hours

        return Response({
            'total': total,
            'category_counts': category_counts,
            'status_counts': status_counts,
            'urgency_counts': urgency_counts,
            'average_response_time_hours': avg_response_time,
        })


class DashboardTrendsView(APIView):
    """
    GET /api/v1/dashboard/trends/?days=30
    Returns daily report counts for the last N days (default 30, max 180).
    Only Security and ICT Admin can access.
    """
    permission_classes = [IsAuthenticated, IsSecurity | IsICTAdmin]

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except ValueError:
            days = 30
        days = max(1, min(days, 180))

        since = timezone.now() - timedelta(days=days - 1)
        counts_by_date = dict(
            Report.objects.filter(created_at__gte=since)
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
