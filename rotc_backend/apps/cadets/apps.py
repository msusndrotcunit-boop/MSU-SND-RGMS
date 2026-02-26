from django.apps import AppConfig


class CadetsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.cadets'
    
    def ready(self):
        """Import signals when app is ready."""
        import apps.cadets.signals
