"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from apps.system.views.root import api_root

# API v1 patterns
api_v1_patterns = [
    path('auth/', include('apps.authentication.urls')),
    path('cadets/', include('apps.cadets.urls')),
    path('grades/', include('apps.grading.urls')),
    path('merit-demerit/', include('apps.grading.merit_demerit_urls')),
    path('', include('apps.attendance.urls')),
    path('', include('apps.activities.urls')),
    path('', include('apps.staff.urls')),
    path('', include('apps.messaging.urls')),
    path('', include('apps.files.urls')),
    path('', include('apps.system.urls')),
    path('reports/', include('apps.reports.urls')),
    path('', include('apps.integration.urls')),
]

urlpatterns = [
    # Root endpoint
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    # API v1 with versioning
    path('api/v1/', include(api_v1_patterns)),
    # Legacy API paths (for backward compatibility during migration)
    path('api/auth/', include('apps.authentication.urls')),
    path('api/cadets/', include('apps.cadets.urls')),
    path('api/grades/', include('apps.grading.urls')),
    path('api/merit-demerit/', include('apps.grading.merit_demerit_urls')),
    path('api/', include('apps.attendance.urls')),
    path('api/', include('apps.activities.urls')),
    path('api/', include('apps.staff.urls')),
    path('api/', include('apps.messaging.urls')),
    path('api/', include('apps.files.urls')),
    path('api/', include('apps.system.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/', include('apps.integration.urls')),
]
