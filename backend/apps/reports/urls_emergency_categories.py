from django.urls import path
from apps.reports.views_emergency_category import EmergencyCategoryListCreateView, EmergencyCategoryDetailView

urlpatterns = [
    path('', EmergencyCategoryListCreateView.as_view(), name='emergency_category_list_create'),
    path('<uuid:id>/', EmergencyCategoryDetailView.as_view(), name='emergency_category_detail'),
]
