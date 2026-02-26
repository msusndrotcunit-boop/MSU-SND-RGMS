from django.apps import AppConfig


class GradingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.grading'
    
    def ready(self):
        """Import signals when app is ready."""
        import apps.grading.signals
