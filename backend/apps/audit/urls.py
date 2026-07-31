from django.urls import path
from apps.audit.views import AuditLogListView, AuditLogExportView

urlpatterns = [
    path('', AuditLogListView.as_view(), name='audit_list'),
    path('export/', AuditLogExportView.as_view(), name='audit_export'),
]
