from django.urls import path
from apps.accounts.views_role import RoleListCreateView, RoleDetailView

urlpatterns = [
    path('', RoleListCreateView.as_view(), name='role_list_create'),
    path('<uuid:id>/', RoleDetailView.as_view(), name='role_detail'),
]
