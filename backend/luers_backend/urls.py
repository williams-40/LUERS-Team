from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.reports.views import SyncView
from apps.core.views import HealthCheckView
from apps.accounts.views_role import PermissionListView


urlpatterns = [
    path('admin/', admin.site.urls),
    path('healthz/', HealthCheckView.as_view(), name='healthz'),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/dashboard/', include('apps.dashboard.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
    path('api/v1/departments/', include('apps.reports.urls_departments')),
    path('api/v1/emergency-categories/', include('apps.reports.urls_emergency_categories')),
    path('api/v1/roles/', include('apps.accounts.urls_roles')),
    path('api/v1/permissions/', PermissionListView.as_view(), name='permission_list'),
    path('api/v1/sync/', SyncView.as_view(), name='sync'), 
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/reports/', include('apps.notifications.urls')),
    
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
