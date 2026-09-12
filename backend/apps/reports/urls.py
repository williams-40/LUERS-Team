from django.urls import path
from apps.reports.views import (
    ReportCreateView, ReportListView, ReportDetailView,
    ReportStatusUpdateView, ReportAssignView, EvidenceUploadView,
    MyReportsView, SyncView, ReportExportView,
    ReportDeleteView, ReportRestoreView, ReportPermanentDeleteView, ReportDeletedListView,
    ReportAssignableOfficersView,
    EmergencyAcknowledgeView, EmergencyRespondView, EmergencyArriveView,
    EmergencyCancelView, EmergencyEscalateView, ReportLocationUpdateView,
)
from apps.reports.views_bulk import BulkStatusUpdateView, BulkAssignView
from apps.reports.views_feedback import ReportFeedbackView, PendingFeedbackListView, AdminFeedbackListView

urlpatterns = [
    path('', ReportListView.as_view(), name='report_list'),
    path('mine/', MyReportsView.as_view(), name='my_reports'),
    path('deleted/', ReportDeletedListView.as_view(), name='report_deleted_list'),
    path('create/', ReportCreateView.as_view(), name='report_create'),
    path('export/', ReportExportView.as_view(), name='report_export'),
    path('bulk/status/', BulkStatusUpdateView.as_view(), name='report_bulk_status'),
    path('bulk/assign/', BulkAssignView.as_view(), name='report_bulk_assign'),
    path('pending-feedback/', PendingFeedbackListView.as_view(), name='report_pending_feedback'),
    path('feedback/', AdminFeedbackListView.as_view(), name='report_feedback_list'),
    path('<uuid:id>/', ReportDetailView.as_view(), name='report_detail'),
    path('<uuid:id>/status/', ReportStatusUpdateView.as_view(), name='report_status'),
    path('<uuid:id>/location/', ReportLocationUpdateView.as_view(), name='report_location'),
    path('<uuid:id>/assign/', ReportAssignView.as_view(), name='report_assign'),
    path('<uuid:id>/acknowledge/', EmergencyAcknowledgeView.as_view(), name='report_acknowledge'),
    path('<uuid:id>/respond/', EmergencyRespondView.as_view(), name='report_respond'),
    path('<uuid:id>/arrive/', EmergencyArriveView.as_view(), name='report_arrive'),
    path('<uuid:id>/cancel/', EmergencyCancelView.as_view(), name='report_cancel'),
    path('<uuid:id>/escalate/', EmergencyEscalateView.as_view(), name='report_escalate'),
    path('<uuid:id>/assignable-officers/', ReportAssignableOfficersView.as_view(), name='report_assignable_officers'),
    path('<uuid:id>/feedback/', ReportFeedbackView.as_view(), name='report_feedback'),
    path('<uuid:id>/evidence/', EvidenceUploadView.as_view(), name='report_evidence'),
    path('<uuid:id>/delete/', ReportDeleteView.as_view(), name='report_delete'),
    path('<uuid:id>/delete/permanent/', ReportPermanentDeleteView.as_view(), name='report_delete_permanent'),
    path('<uuid:id>/restore/', ReportRestoreView.as_view(), name='report_restore'),
    path('sync/', SyncView.as_view(), name='sync'),
]
