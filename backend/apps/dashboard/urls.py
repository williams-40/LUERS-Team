from django.urls import path
from apps.dashboard.views import DashboardSummaryView, DashboardTrendsView, DashboardAnalyticsView

urlpatterns = [
    path('summary/', DashboardSummaryView.as_view(), name='dashboard_summary'),
    path('trends/', DashboardTrendsView.as_view(), name='dashboard_trends'),
    path('analytics/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),
]
