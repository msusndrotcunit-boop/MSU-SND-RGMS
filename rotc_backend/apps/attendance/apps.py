"""
App configuration for attendance app.
"""
from django.apps import AppConfig


class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.attendance'
    
    def ready(self):
        """Import signal handlers when app is ready."""
        import apps.attendance.signals
