"""
URL configuration for integration app
"""
from django.urls import path
from . import views

urlpatterns = [
    # Import endpoints
    path('import/rotcmis', views.import_rotcmis, name='import-rotcmis'),
    path('import/status/<str:task_id>', views.import_status, name='import-status'),
    path('import/csv', views.import_csv, name='import-csv'),
    
    # Export endpoints
    path('export/excel', views.export_excel, name='export-excel'),
    path('export/csv', views.export_csv, name='export-csv'),
]
