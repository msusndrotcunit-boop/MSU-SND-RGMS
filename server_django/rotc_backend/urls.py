from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from apps.api.views import health

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.api.urls')),
    path('', health),
    path('health', health),
    re_path(r'^health\.?$', health),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
