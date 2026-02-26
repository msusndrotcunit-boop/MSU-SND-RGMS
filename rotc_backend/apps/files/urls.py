"""
URL configuration for file upload endpoints.
"""
from django.urls import path
from . import views

urlpatterns = [
    path('upload', views.upload_file, name='upload-file'),
    path('upload/<path:public_id>', views.delete_file, name='delete-file'),
    path('ocr/process', views.process_ocr, name='process-ocr'),
    path('ocr/pdf', views.process_pdf_ocr, name='process-pdf-ocr'),
    path('ocr/document-url', views.process_document_url_ocr, name='process-document-url-ocr'),
    path('ocr/batch', views.batch_process_ocr_endpoint, name='batch-process-ocr'),
    path('ocr/status', views.ocr_status, name='ocr-status'),
    path('ocr/cache', views.clear_ocr_cache, name='clear-ocr-cache'),
]
