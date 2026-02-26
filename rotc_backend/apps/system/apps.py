from django.apps import AppConfig


class SystemConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.system'
    
    def ready(self):
        """Import signal handlers when the app is ready."""
        import apps.system.signals
