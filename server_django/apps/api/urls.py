from django.urls import path
from . import views

urlpatterns = [
    path('auth/login', views.admin_login),
    path('auth/cadet-login', views.cadet_login),
    path('auth/staff-login-no-pass', views.staff_login),
    path('auth/heartbeat', views.heartbeat),
    path('cadet/profile', views.cadet_profile),
    path('admin/analytics', views.admin_analytics),
    path('admin/locations', views.admin_locations),
    path('attendance/events', views.attendance_events),
    path('admin/sync/publish', views.publish_event),
    path('admin/grades/<int:cadet_id>', views.compute_grade),
    path('images/cadets/<int:cid>', views.cadet_image),
    path('images/staff/<int:sid>', views.staff_image),
]
