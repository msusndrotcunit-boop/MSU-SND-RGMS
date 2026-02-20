from django.apps import AppConfig
from django.db import connection

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.api'

    def ready(self):
        # Seed minimal sample data on first run
        try:
            from .models import Cadet, Grade
            if not connection.introspection.table_names():
                return
            if Cadet.objects.count() == 0:
                c1 = Cadet.objects.create(student_id='S-0001', first_name='Juan', last_name='Doe', course='MS1', is_profile_completed=False)
                c2 = Cadet.objects.create(student_id='S-0002', first_name='Maria', last_name='Santos', course='MS2', is_profile_completed=True)
                Grade.objects.create(cadet_id=c1.id, final_percent=82.5, transmutation='2.50', passed=True, status='Completed')
                Grade.objects.create(cadet_id=c2.id, final_percent=72.0, transmutation='5.00', passed=False, status='Failed')
        except Exception:
            pass
