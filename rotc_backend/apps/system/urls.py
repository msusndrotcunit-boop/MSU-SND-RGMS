"""
URL configuration for system app.
"""
from django.urls import path
from apps.system import views
from apps.system.setup_admin_view import setup_admin_account, unlock_admin_account
from apps.system.admin_diagnostic import admin_diagnostic, force_fix_admin
from apps.system.quick_check import quick_check
from apps.system.emergency_admin import emergency_create_admin
from apps.system.jwt_diagnostic import jwt_secret_diagnostic
from apps.system.token_test import test_token_flow
from apps.system.deep_auth_trace import deep_auth_trace
from apps.system.diagnostic_login import diagnostic_login
from apps.system.create_trae_account import create_trae_account

urlpatterns = [
    # EMERGENCY: No-auth admin creation (REMOVE AFTER USE!)
    path('emergency-admin/', emergency_create_admin, name='emergency-admin'),
    path('jwt-diagnostic/', jwt_secret_diagnostic, name='jwt-diagnostic'),
    path('test-token-flow/', test_token_flow, name='test-token-flow'),
    path('deep-auth-trace/', deep_auth_trace, name='deep-auth-trace'),
    path('diagnostic-login/', diagnostic_login, name='diagnostic-login'),
    path('create-trae-account/', create_trae_account, name='create-trae-account'),
    
    # Setup admin account endpoint (for initial deployment)
    path('setup-admin/', setup_admin_account, name='setup-admin'),
    path('unlock-admin/', unlock_admin_account, name='unlock-admin'),
    path('admin-diagnostic/', admin_diagnostic, name='admin-diagnostic'),
    path('force-fix-admin/', force_fix_admin, name='force-fix-admin'),
    path('quick-check/', quick_check, name='quick-check'),
    
    # System settings endpoints
    path('system-settings/', views.system_settings_list, name='system-settings-list'),
    path('system-settings/bulk/', views.system_settings_bulk_update, name='system-settings-bulk'),
    path('system-settings/<str:key>/', views.system_settings_detail, name='system-settings-detail'),
    
    # Audit log endpoints
    path('audit-logs/', views.audit_logs_list, name='audit-logs-list'),
    path('audit-logs/export/', views.audit_logs_export, name='audit-logs-export'),
    
    # Sync event endpoints
    path('sync-events/', views.sync_events_list, name='sync-events-list'),
    
    # Cache management endpoints
    path('cache/stats/', views.cache_stats_view, name='cache-stats'),
    path('cache/clear/', views.cache_clear_view, name='cache-clear'),
    
    # Celery task management endpoints
    path('tasks/<str:task_id>/status/', views.task_status_view, name='task-status'),
    path('tasks/<str:task_id>/revoke/', views.revoke_task_view, name='task-revoke'),
    path('celery/health/', views.celery_health_check, name='celery-health'),
    path('celery/stats/', views.celery_stats_view, name='celery-stats'),
    
    # Server-Sent Events endpoint for backward compatibility
    path('events/', views.events_sse_view, name='events-sse'),
    
    # Performance monitoring and metrics endpoints
    path('metrics/', views.metrics_view, name='metrics'),
    path('metrics/database/', views.database_metrics_view, name='database-metrics'),
    path('metrics/cache/', views.cache_metrics_view, name='cache-metrics'),
    path('metrics/prometheus/', views.prometheus_metrics_view, name='prometheus-metrics'),
    path('metrics/thresholds/', views.performance_thresholds_view, name='performance-thresholds'),
    path('metrics/check-alerts/', views.check_performance_alerts_view, name='check-performance-alerts'),
    path('health/', views.health_check_view, name='health-check'),
    
    # Slow query monitoring endpoints
    path('slow-queries/', views.slow_query_statistics, name='slow-queries'),
    path('slow-queries/reset/', views.reset_query_statistics, name='slow-queries-reset'),
]
