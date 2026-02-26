"""
API views for PDF report generation.
"""
import logging
import hashlib
from django.http import HttpResponse, JsonResponse
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsAdmin, IsTrainingStaff
from apps.cadets.models import Cadet
from apps.attendance.models import TrainingDay
from apps.activities.models import Activity
from apps.system.models import AuditLog
from .generators import (
    CadetProfilePDFGenerator,
    GradeReportPDFGenerator,
    AttendanceReportPDFGenerator,
    CertificatePDFGenerator
)
from .tasks import batch_generate_cadet_pdfs, batch_generate_certificates

logger = logging.getLogger(__name__)


def get_cache_key(report_type, **kwargs):
    """Generate a cache key for PDF reports."""
    key_parts = [report_type]
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}:{v}")
    key_string = "|".join(key_parts)
    hash_key = hashlib.md5(key_string.encode()).hexdigest()
    return f"pdf_report:{hash_key}"


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin | IsTrainingStaff])
def cadet_profile_pdf(request, cadet_id):
    """
    Generate a PDF report for a cadet profile.
    
    GET /api/reports/cadet/:id
    
    Returns:
        PDF file with cadet profile information
    """
    try:
        # Check cache first
        cache_key = get_cache_key('cadet_profile', cadet_id=cadet_id)
        cached_pdf = cache.get(cache_key)
        
        if cached_pdf:
            logger.info(f"Returning cached PDF for cadet {cadet_id}")
            response = HttpResponse(cached_pdf, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="cadet_profile_{cadet_id}.pdf"'
            return response
        
        # Get cadet with grades
        try:
            cadet = Cadet.objects.select_related('grades').get(id=cadet_id)
        except Cadet.DoesNotExist:
            return JsonResponse({
                'error': True,
                'message': f'Cadet with ID {cadet_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Generate PDF
        generator = CadetProfilePDFGenerator()
        pdf_buffer = generator.generate(cadet)
        pdf_bytes = pdf_buffer.getvalue()
        
        # Cache the PDF for 1 hour
        cache.set(cache_key, pdf_bytes, 3600)
        
        # Log the operation
        AuditLog.objects.create(
            table_name='reports',
            operation='CREATE',
            record_id=cadet_id,
            user_id=request.user.id,
            payload={
                'report_type': 'cadet_profile',
                'cadet_id': cadet_id,
                'generated_at': timezone.now().isoformat()
            }
        )
        
        # Return PDF response
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="cadet_profile_{cadet.student_id}.pdf"'
        
        logger.info(f"Generated cadet profile PDF for cadet {cadet_id}")
        return response
        
    except Exception as e:
        logger.error(f"Error generating cadet profile PDF: {str(e)}", exc_info=True)
        return JsonResponse({
            'error': True,
            'message': 'Failed to generate PDF report',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin | IsTrainingStaff])
def grade_report_pdf(request):
    """
    Generate a PDF report for grades.
    
    GET /api/reports/grades?company=&platoon=&limit=50
    
    Query Parameters:
        - company: Filter by company
        - platoon: Filter by platoon
        - limit: Maximum number of cadets (default: 50)
    
    Returns:
        PDF file with grades report
    """
    try:
        # Get query parameters
        company = request.GET.get('company')
        platoon = request.GET.get('platoon')
        limit = int(request.GET.get('limit', 50))
        
        # Build cache key
        cache_key = get_cache_key('grades', company=company, platoon=platoon, limit=limit)
        cached_pdf = cache.get(cache_key)
        
        if cached_pdf:
            logger.info("Returning cached grades report PDF")
            response = HttpResponse(cached_pdf, content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="grades_report.pdf"'
            return response
        
        # Query cadets with filters
        queryset = Cadet.objects.select_related('grades').filter(is_archived=False)
        
        if company:
            queryset = queryset.filter(company=company)
        if platoon:
            queryset = queryset.filter(platoon=platoon)
        
        cadets = queryset[:limit]
        
        if not cadets:
            return JsonResponse({
                'error': True,
                'message': 'No cadets found matching the filters'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Generate PDF
        filters = {'company': company, 'platoon': platoon}
        generator = GradeReportPDFGenerator()
        pdf_buffer = generator.generate(cadets, filters)
        pdf_bytes = pdf_buffer.getvalue()
        
        # Cache the PDF for 1 hour
        cache.set(cache_key, pdf_bytes, 3600)
        
        # Log the operation
        AuditLog.objects.create(
            table_name='reports',
            operation='CREATE',
            record_id=0,
            user_id=request.user.id,
            payload={
                'report_type': 'grades',
                'filters': filters,
                'cadet_count': len(cadets),
                'generated_at': timezone.now().isoformat()
            }
        )
        
        # Return PDF response
        filename = f"grades_report_{company or 'all'}_{platoon or 'all'}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        logger.info(f"Generated grades report PDF with {len(cadets)} cadets")
        return response
        
    except Exception as e:
        logger.error(f"Error generating grades report PDF: {str(e)}", exc_info=True)
        return JsonResponse({
            'error': True,
            'message': 'Failed to generate PDF report',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin | IsTrainingStaff])
def attendance_report_pdf(request):
    """
    Generate a PDF report for attendance.
    
    GET /api/reports/attendance?date_from=&date_to=&limit=30
    
    Query Parameters:
        - date_from: Start date (YYYY-MM-DD)
        - date_to: End date (YYYY-MM-DD)
        - limit: Maximum number of training days (default: 30)
    
    Returns:
        PDF file with attendance report
    """
    try:
        # Get query parameters
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        limit = int(request.GET.get('limit', 30))
        
        # Build cache key
        cache_key = get_cache_key('attendance', date_from=date_from, date_to=date_to, limit=limit)
        cached_pdf = cache.get(cache_key)
        
        if cached_pdf:
            logger.info("Returning cached attendance report PDF")
            response = HttpResponse(cached_pdf, content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="attendance_report.pdf"'
            return response
        
        # Query training days with filters
        queryset = TrainingDay.objects.all().order_by('-date')
        
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        
        training_days = queryset[:limit]
        
        if not training_days:
            return JsonResponse({
                'error': True,
                'message': 'No training days found matching the filters'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Generate PDF
        filters = {'date_from': date_from, 'date_to': date_to}
        generator = AttendanceReportPDFGenerator()
        pdf_buffer = generator.generate(training_days, filters)
        pdf_bytes = pdf_buffer.getvalue()
        
        # Cache the PDF for 1 hour
        cache.set(cache_key, pdf_bytes, 3600)
        
        # Log the operation
        AuditLog.objects.create(
            table_name='reports',
            operation='CREATE',
            record_id=0,
            user_id=request.user.id,
            payload={
                'report_type': 'attendance',
                'filters': filters,
                'training_day_count': len(training_days),
                'generated_at': timezone.now().isoformat()
            }
        )
        
        # Return PDF response
        filename = f"attendance_report_{date_from or 'all'}_{date_to or 'all'}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        logger.info(f"Generated attendance report PDF with {len(training_days)} training days")
        return response
        
    except Exception as e:
        logger.error(f"Error generating attendance report PDF: {str(e)}", exc_info=True)
        return JsonResponse({
            'error': True,
            'message': 'Failed to generate PDF report',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin | IsTrainingStaff])
def achievement_certificate_pdf(request, activity_id):
    """
    Generate an achievement certificate PDF.
    
    GET /api/certificates/:activity_id?cadet_name=
    
    Query Parameters:
        - cadet_name: Name of the cadet (required)
    
    Returns:
        PDF file with achievement certificate
    """
    try:
        # Get cadet name from query params
        cadet_name = request.GET.get('cadet_name')
        
        if not cadet_name:
            return JsonResponse({
                'error': True,
                'message': 'cadet_name query parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check cache first
        cache_key = get_cache_key('certificate', activity_id=activity_id, cadet_name=cadet_name)
        cached_pdf = cache.get(cache_key)
        
        if cached_pdf:
            logger.info(f"Returning cached certificate for activity {activity_id}")
            response = HttpResponse(cached_pdf, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="certificate_{activity_id}.pdf"'
            return response
        
        # Get activity
        try:
            activity = Activity.objects.get(id=activity_id)
        except Activity.DoesNotExist:
            return JsonResponse({
                'error': True,
                'message': f'Activity with ID {activity_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Generate verification code
        verification_data = f"{activity_id}:{cadet_name}:{activity.date}"
        verification_code = hashlib.sha256(verification_data.encode()).hexdigest()[:16].upper()
        
        # Generate PDF
        generator = CertificatePDFGenerator()
        pdf_buffer = generator.generate(activity, cadet_name, verification_code)
        pdf_bytes = pdf_buffer.getvalue()
        
        # Cache the PDF for 1 hour
        cache.set(cache_key, pdf_bytes, 3600)
        
        # Log the operation
        AuditLog.objects.create(
            table_name='reports',
            operation='CREATE',
            record_id=activity_id,
            user_id=request.user.id,
            payload={
                'report_type': 'certificate',
                'activity_id': activity_id,
                'cadet_name': cadet_name,
                'verification_code': verification_code,
                'generated_at': timezone.now().isoformat()
            }
        )
        
        # Return PDF response
        safe_name = cadet_name.replace(' ', '_')
        filename = f"certificate_{safe_name}_{activity_id}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        logger.info(f"Generated certificate PDF for activity {activity_id}, cadet {cadet_name}")
        return response
        
    except Exception as e:
        logger.error(f"Error generating certificate PDF: {str(e)}", exc_info=True)
        return JsonResponse({
            'error': True,
            'message': 'Failed to generate certificate',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin | IsTrainingStaff])
def batch_cadet_pdfs(request):
    """
    Generate PDF reports for multiple cadets in batch.
    
    POST /api/reports/batch/cadets
    
    Request Body:
        {
            "cadet_ids": [1, 2, 3, ...]
        }
    
    Returns:
        Task ID for tracking batch generation progress
    """
    try:
        cadet_ids = request.data.get('cadet_ids', [])
        
        if not cadet_ids or not isinstance(cadet_ids, list):
            return JsonResponse({
                'error': True,
                'message': 'cadet_ids must be a non-empty list'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limit batch size
        if len(cadet_ids) > 100:
            return JsonResponse({
                'error': True,
                'message': 'Batch size cannot exceed 100 cadets'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Queue the batch generation task
        task = batch_generate_cadet_pdfs.delay(cadet_ids, request.user.id)
        
        logger.info(f"Queued batch PDF generation for {len(cadet_ids)} cadets, task_id: {task.id}")
        
        return JsonResponse({
            'task_id': task.id,
            'message': f'Batch PDF generation started for {len(cadet_ids)} cadets',
            'cadet_count': len(cadet_ids)
        }, status=status.HTTP_202_ACCEPTED)
        
    except Exception as e:
        logger.error(f"Error queuing batch PDF generation: {str(e)}", exc_info=True)
        return JsonResponse({
            'error': True,
            'message': 'Failed to queue batch PDF generation',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin | IsTrainingStaff])
def batch_certificates(request):
    """
    Generate achievement certificates for multiple cadets in batch.
    
    POST /api/reports/batch/certificates
    
    Request Body:
        {
            "activity_id": 1,
            "cadet_names": ["John Doe", "Jane Smith", ...]
        }
    
    Returns:
        Task ID for tracking batch generation progress
    """
    try:
        activity_id = request.data.get('activity_id')
        cadet_names = request.data.get('cadet_names', [])
        
        if not activity_id:
            return JsonResponse({
                'error': True,
                'message': 'activity_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not cadet_names or not isinstance(cadet_names, list):
            return JsonResponse({
                'error': True,
                'message': 'cadet_names must be a non-empty list'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limit batch size
        if len(cadet_names) > 100:
            return JsonResponse({
                'error': True,
                'message': 'Batch size cannot exceed 100 certificates'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Queue the batch generation task
        task = batch_generate_certificates.delay(activity_id, cadet_names, request.user.id)
        
        logger.info(f"Queued batch certificate generation for {len(cadet_names)} cadets, task_id: {task.id}")
        
        return JsonResponse({
            'task_id': task.id,
            'message': f'Batch certificate generation started for {len(cadet_names)} cadets',
            'certificate_count': len(cadet_names)
        }, status=status.HTTP_202_ACCEPTED)
        
    except Exception as e:
        logger.error(f"Error queuing batch certificate generation: {str(e)}", exc_info=True)
        return JsonResponse({
            'error': True,
            'message': 'Failed to queue batch certificate generation',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
