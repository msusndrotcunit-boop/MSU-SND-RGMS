"""
App configuration for messaging app.
"""
from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.messaging'
    
    def ready(self):
        """Import signal handlers when app is ready."""
        import apps.messaging.signals
