from django.urls import path
from apps.reports.views_department import (
    DepartmentListCreateView, DepartmentDetailView, DepartmentResponderCreateView,
)

urlpatterns = [
    path('', DepartmentListCreateView.as_view(), name='department_list_create'),
    path('<uuid:id>/', DepartmentDetailView.as_view(), name='department_detail'),
    path('<uuid:id>/responders/', DepartmentResponderCreateView.as_view(), name='department_responder_create'),
]
