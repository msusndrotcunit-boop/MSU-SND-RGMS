"""
URL configuration for reports app.
"""
from django.urls import path
from . import views

urlpatterns = [
    # Cadet profile PDF
    path('cadet/<int:cadet_id>', views.cadet_profile_pdf, name='cadet-profile-pdf'),
    
    # Grade report PDF
    path('grades', views.grade_report_pdf, name='grade-report-pdf'),
    
    # Attendance report PDF
    path('attendance', views.attendance_report_pdf, name='attendance-report-pdf'),
    
    # Achievement certificate PDF
    path('certificates/<int:activity_id>', views.achievement_certificate_pdf, name='achievement-certificate-pdf'),
    
    # Batch PDF generation
    path('batch/cadets', views.batch_cadet_pdfs, name='batch-cadet-pdfs'),
    path('batch/certificates', views.batch_certificates, name='batch-certificates'),
]
