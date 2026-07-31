from django.urls import path
from apps.reports.views import (
    ReportCreateView, ReportListView, ReportDetailView,
    ReportStatusUpdateView, ReportAssignView, EvidenceUploadView,
    MyReportsView, SyncView, ReportRevealIdentityView, ReportExportView
)

urlpatterns = [
    path('', ReportListView.as_view(), name='report_list'),
    path('mine/', MyReportsView.as_view(), name='my_reports'),
    path('create/', ReportCreateView.as_view(), name='report_create'),
    path('export/', ReportExportView.as_view(), name='report_export'),
    path('<uuid:id>/', ReportDetailView.as_view(), name='report_detail'),
    path('<uuid:id>/status/', ReportStatusUpdateView.as_view(), name='report_status'),
    path('<uuid:id>/assign/', ReportAssignView.as_view(), name='report_assign'),
    path('<uuid:id>/evidence/', EvidenceUploadView.as_view(), name='report_evidence'),
    path('<uuid:id>/reveal/', ReportRevealIdentityView.as_view(), name='report_reveal'),
    path('sync/', SyncView.as_view(), name='sync'),
]