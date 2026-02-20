from django.urls import path, include
from . import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from .views_sets import CadetViewSet, StaffViewSet, AttendanceViewSet, GradeViewSet, MeritDemeritLogViewSet

router = DefaultRouter()
router.register(r'cadets', CadetViewSet, basename='cadet')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'grades', GradeViewSet, basename='grades')
router.register(r'merit-logs', MeritDemeritLogViewSet, basename='merit-logs')

urlpatterns = [
    path('auth/login', views.admin_login),
    path('auth/cadet-login', views.cadet_login),
    path('auth/staff-login-no-pass', views.staff_login),
    path('auth/heartbeat', views.heartbeat),
    path('health', views.health),
    path('auth/token', TokenObtainPairView.as_view()),
    path('auth/token/refresh', TokenRefreshView.as_view()),
    path('cadet/profile', views.cadet_profile),
    path('admin/analytics', views.admin_analytics),
    path('admin/system-status', views.admin_system_status),
    path('admin/cadets', views.admin_cadets),
    path('admin/cadets/archived', views.admin_cadets_archived),
    path('admin/locations', views.admin_locations),
    path('admin/settings/cadet-source', views.admin_settings_cadet_source),
    path('admin/settings/cadet-source/update', views.admin_update_cadet_source),
    path('admin/import-cadets', views.admin_import_cadets_file),
    path('admin/import-cadets-url', views.admin_import_cadets_url),
    path('admin/sync-cadets', views.admin_sync_cadets),
    path('attendance/events', views.attendance_events),
    path('admin/sync/publish', views.publish_event),
    path('admin/grades/<int:cadet_id>', views.compute_grade),
    path('images/cadets/<int:cid>', views.cadet_image),
    path('images/staff/<int:sid>', views.staff_image),
    path('uploads', views.upload_file),
    path('staff', views.staff_list),
    path('', include(router.urls)),
]
