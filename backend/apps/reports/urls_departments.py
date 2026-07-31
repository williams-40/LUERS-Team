from django.urls import path
from apps.reports.views_department import DepartmentListCreateView, DepartmentDetailView

urlpatterns = [
    path('', DepartmentListCreateView.as_view(), name='department_list_create'),
    path('<uuid:id>/', DepartmentDetailView.as_view(), name='department_detail'),
]
