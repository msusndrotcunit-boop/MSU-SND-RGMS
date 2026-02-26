"""
System views package.
"""
# Import all views from the parent views.py module
import sys
import os

# Add parent directory to path to import views.py
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Import all view functions from views.py
try:
    from ..views import (
        system_settings_list,
        system_settings_detail,
        system_settings_bulk_update,
        cache_stats_view,
        cache_clear_view,
        events_sse_view,
        task_status_view,
        celery_health_check,
        celery_stats_view,
        revoke_task_view,
        audit_logs_list,
        audit_logs_export,
        sync_events_list,
        metrics_view,
        database_metrics_view,
    )
except ImportError:
    # If relative import fails, try absolute import
    import importlib.util
    views_path = os.path.join(parent_dir, 'system', 'views.py')
    spec = importlib.util.spec_from_file_location("system_views", views_path)
    system_views = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(system_views)
    
    system_settings_list = system_views.system_settings_list
    system_settings_detail = system_views.system_settings_detail
    system_settings_bulk_update = system_views.system_settings_bulk_update
    cache_stats_view = system_views.cache_stats_view
    cache_clear_view = system_views.cache_clear_view
    events_sse_view = system_views.events_sse_view
    task_status_view = system_views.task_status_view
    celery_health_check = system_views.celery_health_check
    celery_stats_view = system_views.celery_stats_view
    revoke_task_view = system_views.revoke_task_view
    audit_logs_list = system_views.audit_logs_list
    audit_logs_export = system_views.audit_logs_export
    sync_events_list = system_views.sync_events_list
    metrics_view = system_views.metrics_view
    database_metrics_view = system_views.database_metrics_view

# Import frontend view
from .frontend import serve_react_app

# Export all views
__all__ = [
    'system_settings_list',
    'system_settings_detail',
    'system_settings_bulk_update',
    'cache_stats_view',
    'cache_clear_view',
    'events_sse_view',
    'task_status_view',
    'celery_health_check',
    'celery_stats_view',
    'revoke_task_view',
    'audit_logs_list',
    'audit_logs_export',
    'sync_events_list',
    'metrics_view',
    'database_metrics_view',
    'serve_react_app',
]
