from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.authentication'
    
    def ready(self):
        """Import signal handlers when app is ready."""
        import apps.authentication.signals
