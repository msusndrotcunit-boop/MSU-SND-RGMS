"""
Views for data import/export and ROTCMIS integration
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from django.db.models import Q
from datetime import datetime
import logging

from apps.authentication.permissions import IsAdmin
from apps.cadets.models import Cadet, Grades
from apps.grading.models import MeritDemeritLog
from apps.attendance.models import AttendanceRecord, TrainingDay
from apps.activities.models import Activity
from apps.system.models import AuditLog

from .serializers import (
    ROTCMISImportSerializer,
    ImportStatusSerializer,
    ExportFilterSerializer,
    CSVImportSerializer
)
from .tasks import import_rotcmis_data
from .importers import ROTCMISImporter, ImportResult, CSVImporter, DataMergeStrategy
from .exporters import CSVExporter, ExcelExporter

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def import_rotcmis(request):
    """
    Import cadet data from ROTCMIS JSON format
    
    POST /api/import/rotcmis
    
    Request body:
    {
        "data": [
            {
                "student_id": "2021-12345",
                "first_name": "John",
                "last_name": "Doe",
                ...
            }
        ],
        "merge_strategy": "skip",  // or "update", "error"
        "async_processing": true
    }
    
    Response:
    {
        "task_id": "abc-123",  // if async
        "status": "processing",
        "message": "Import started"
    }
    
    or (if sync):
    {
        "success_count": 10,
        "error_count": 2,
        "errors": [...],
        ...
    }
    """
    serializer = ROTCMISImportSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data['data']
    merge_strategy = serializer.validated_data['merge_strategy']
    async_processing = serializer.validated_data['async_processing']
    
    # Validate data size
    if len(data) == 0:
        return Response(
            {'error': 'No data provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # For large imports or if async requested, use Celery
    if async_processing or len(data) > 50:
        task = import_rotcmis_data.delay(data, request.user.id, merge_strategy)
        
        # Log import initiation
        AuditLog.objects.create(
            table_name='cadets',
            operation='IMPORT_INITIATED',
            record_id=None,
            user_id=request.user.id,
            payload={
                'source': 'rotcmis',
                'task_id': task.id,
                'record_count': len(data),
                'merge_strategy': merge_strategy
            }
        )
        
        return Response({
            'task_id': task.id,
            'status': 'processing',
            'message': f'Import started for {len(data)} records',
            'total_records': len(data)
        }, status=status.HTTP_202_ACCEPTED)
    
    # Synchronous processing for small imports
    result = ImportResult()
    
    for idx, cadet_data in enumerate(data):
        try:
            # Validate data
            is_valid, errors = ROTCMISImporter.validate_cadet_data(cadet_data)
            if not is_valid:
                for error in errors:
                    result.add_error(idx + 1, 'validation', error, cadet_data)
                continue
            
            # Normalize data
            normalized_data = ROTCMISImporter.normalize_cadet_data(cadet_data)
            
            # Check for existing cadet
            student_id = normalized_data.get('student_id')
            existing_cadet = None
            
            if student_id:
                try:
                    existing_cadet = Cadet.objects.get(student_id=student_id)
                except Cadet.DoesNotExist:
                    pass
            
            if existing_cadet:
                if DataMergeStrategy.should_update(merge_strategy, existing_cadet, normalized_data):
                    for key, value in normalized_data.items():
                        setattr(existing_cadet, key, value)
                    existing_cadet.save()
                    result.add_success(existing_cadet.id, created=False)
                else:
                    result.add_warning(f"Skipped existing cadet: {student_id}")
            else:
                cadet = Cadet.objects.create(**normalized_data)
                result.add_success(cadet.id, created=True)
        
        except Exception as e:
            logger.error(f"Error importing cadet at row {idx + 1}: {str(e)}")
            result.add_error(idx + 1, 'exception', str(e), cadet_data)
    
    # Log import operation
    AuditLog.objects.create(
        table_name='cadets',
        operation='BULK_IMPORT',
        record_id=None,
        user_id=request.user.id,
        payload={
            'source': 'rotcmis',
            'total_records': len(data),
            'success_count': result.success_count,
            'error_count': result.error_count
        }
    )
    
    return Response(result.to_dict(), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def import_status(request, task_id):
    """
    Get status of an import task
    
    GET /api/import/status/<task_id>
    
    Response:
    {
        "task_id": "abc-123",
        "status": "processing",
        "progress": 45,
        "total": 100,
        "success_count": 40,
        "error_count": 5
    }
    """
    # Check cache for task status
    task_data = cache.get(f'import_task_{task_id}')
    
    if not task_data:
        return Response(
            {'error': 'Task not found or expired'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    return Response({
        'task_id': task_id,
        **task_data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def export_excel(request):
    """
    Export data to Excel format
    
    GET /api/export/excel?entity_type=cadets&company=Alpha&date_from=2024-01-01
    
    Query parameters:
    - entity_type: cadets, grades, attendance, activities (required)
    - date_from: Start date (optional)
    - date_to: End date (optional)
    - company: Filter by company (optional)
    - platoon: Filter by platoon (optional)
    - status: Filter by status (optional)
    
    Returns: Excel file download
    """
    serializer = ExportFilterSerializer(data=request.query_params)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    entity_type = serializer.validated_data['entity_type']
    filters = serializer.validated_data
    
    try:
        data, filename = _get_export_data(entity_type, filters)
        
        # Log export operation
        AuditLog.objects.create(
            table_name=entity_type,
            operation='EXPORT',
            record_id=None,
            user_id=request.user.id,
            payload={
                'format': 'excel',
                'filters': filters,
                'record_count': len(data)
            }
        )
        
        return ExcelExporter.export_to_response(
            data,
            f"{filename}.xlsx",
            sheet_name=entity_type.capitalize()
        )
    
    except Exception as e:
        logger.error(f"Error exporting to Excel: {str(e)}")
        return Response(
            {'error': f'Export failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def export_csv(request):
    """
    Export data to CSV format
    
    GET /api/export/csv?entity_type=cadets&company=Alpha
    
    Query parameters: Same as export_excel
    
    Returns: CSV file download
    """
    serializer = ExportFilterSerializer(data=request.query_params)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    entity_type = serializer.validated_data['entity_type']
    filters = serializer.validated_data
    
    try:
        data, filename = _get_export_data(entity_type, filters)
        
        # Log export operation
        AuditLog.objects.create(
            table_name=entity_type,
            operation='EXPORT',
            record_id=None,
            user_id=request.user.id,
            payload={
                'format': 'csv',
                'filters': filters,
                'record_count': len(data)
            }
        )
        
        return CSVExporter.export_to_response(data, f"{filename}.csv")
    
    except Exception as e:
        logger.error(f"Error exporting to CSV: {str(e)}")
        return Response(
            {'error': f'Export failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def import_csv(request):
    """
    Import data from CSV file
    
    POST /api/import/csv
    
    Form data:
    - file: CSV file
    - entity_type: cadets, grades, attendance
    - merge_strategy: skip, update, error
    
    Response:
    {
        "success_count": 10,
        "error_count": 2,
        "errors": [...]
    }
    """
    serializer = CSVImportSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    csv_file = serializer.validated_data['file']
    entity_type = serializer.validated_data['entity_type']
    merge_strategy = serializer.validated_data['merge_strategy']
    
    try:
        # Parse CSV
        data = CSVImporter.parse_csv_file(csv_file)
        
        if not data:
            return Response(
                {'error': 'CSV file is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process based on entity type
        if entity_type == 'cadets':
            result = _import_cadets_from_csv(data, merge_strategy, request.user.id)
        elif entity_type == 'grades':
            result = _import_grades_from_csv(data, merge_strategy, request.user.id)
        elif entity_type == 'attendance':
            result = _import_attendance_from_csv(data, merge_strategy, request.user.id)
        else:
            return Response(
                {'error': f'Unsupported entity type: {entity_type}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log import operation
        AuditLog.objects.create(
            table_name=entity_type,
            operation='CSV_IMPORT',
            record_id=None,
            user_id=request.user.id,
            payload={
                'total_records': len(data),
                'success_count': result.success_count,
                'error_count': result.error_count,
                'merge_strategy': merge_strategy
            }
        )
        
        return Response(result.to_dict(), status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error importing CSV: {str(e)}")
        return Response(
            {'error': f'Import failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Helper functions

def _get_export_data(entity_type, filters):
    """Get data for export based on entity type and filters"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if entity_type == 'cadets':
        queryset = Cadet.objects.filter(is_archived=False)
        
        if filters.get('company'):
            queryset = queryset.filter(company=filters['company'])
        if filters.get('platoon'):
            queryset = queryset.filter(platoon=filters['platoon'])
        if filters.get('status'):
            queryset = queryset.filter(status=filters['status'])
        
        data = list(queryset.values(
            'id', 'student_id', 'first_name', 'last_name', 'middle_name',
            'company', 'platoon', 'course', 'year_level', 'status',
            'email', 'contact_number', 'created_at'
        ))
        filename = f"cadets_export_{timestamp}"
    
    elif entity_type == 'grades':
        queryset = Grades.objects.select_related('cadet').all()
        
        if filters.get('company'):
            queryset = queryset.filter(cadet__company=filters['company'])
        if filters.get('platoon'):
            queryset = queryset.filter(cadet__platoon=filters['platoon'])
        
        data = []
        for grade in queryset:
            data.append({
                'cadet_id': grade.cadet.id,
                'student_id': grade.cadet.student_id,
                'name': f"{grade.cadet.first_name} {grade.cadet.last_name}",
                'company': grade.cadet.company,
                'platoon': grade.cadet.platoon,
                'attendance_present': grade.attendance_present,
                'merit_points': grade.merit_points,
                'demerit_points': grade.demerit_points,
                'prelim_score': grade.prelim_score,
                'midterm_score': grade.midterm_score,
                'final_score': grade.final_score
            })
        filename = f"grades_export_{timestamp}"
    
    elif entity_type == 'attendance':
        queryset = AttendanceRecord.objects.select_related('cadet', 'training_day').all()
        
        if filters.get('date_from'):
            queryset = queryset.filter(training_day__date__gte=filters['date_from'])
        if filters.get('date_to'):
            queryset = queryset.filter(training_day__date__lte=filters['date_to'])
        if filters.get('company'):
            queryset = queryset.filter(cadet__company=filters['company'])
        if filters.get('platoon'):
            queryset = queryset.filter(cadet__platoon=filters['platoon'])
        
        data = list(queryset.values(
            'id', 'training_day__date', 'training_day__title',
            'cadet__student_id', 'cadet__first_name', 'cadet__last_name',
            'status', 'time_in', 'time_out', 'created_at'
        ))
        filename = f"attendance_export_{timestamp}"
    
    elif entity_type == 'activities':
        queryset = Activity.objects.all()
        
        if filters.get('date_from'):
            queryset = queryset.filter(date__gte=filters['date_from'])
        if filters.get('date_to'):
            queryset = queryset.filter(date__lte=filters['date_to'])
        
        data = list(queryset.values(
            'id', 'title', 'description', 'date', 'type', 'created_at'
        ))
        filename = f"activities_export_{timestamp}"
    
    else:
        raise ValueError(f"Unsupported entity type: {entity_type}")
    
    return data, filename


def _import_cadets_from_csv(data, merge_strategy, user_id):
    """Import cadets from CSV data"""
    result = ImportResult()
    
    # Validate required headers
    required_headers = ['student_id', 'first_name', 'last_name']
    is_valid, missing = CSVImporter.validate_headers(data, required_headers)
    
    if not is_valid:
        result.add_error(0, 'headers', f"Missing required headers: {', '.join(missing)}")
        return result
    
    for idx, row in enumerate(data):
        try:
            student_id = row.get('student_id', '').strip()
            if not student_id:
                result.add_error(idx + 1, 'student_id', 'student_id is required')
                continue
            
            # Check for existing cadet
            try:
                existing_cadet = Cadet.objects.get(student_id=student_id)
                
                if DataMergeStrategy.should_update(merge_strategy, existing_cadet, row):
                    # Update existing
                    for key, value in row.items():
                        if hasattr(existing_cadet, key) and value:
                            setattr(existing_cadet, key, value)
                    existing_cadet.save()
                    result.add_success(existing_cadet.id, created=False)
                else:
                    result.add_warning(f"Skipped existing cadet: {student_id}")
            
            except Cadet.DoesNotExist:
                # Create new cadet
                cadet_data = {
                    'student_id': student_id,
                    'first_name': row.get('first_name', ''),
                    'last_name': row.get('last_name', ''),
                    'middle_name': row.get('middle_name', ''),
                    'company': row.get('company', ''),
                    'platoon': row.get('platoon', ''),
                    'course': row.get('course', ''),
                    'year_level': int(row['year_level']) if row.get('year_level') else None,
                    'status': row.get('status', 'Ongoing'),
                    'email': row.get('email', ''),
                    'contact_number': row.get('contact_number', '')
                }
                cadet = Cadet.objects.create(**cadet_data)
                result.add_success(cadet.id, created=True)
        
        except Exception as e:
            result.add_error(idx + 1, 'exception', str(e), row)
    
    return result


def _import_grades_from_csv(data, merge_strategy, user_id):
    """Import grades from CSV data"""
    result = ImportResult()
    
    required_headers = ['student_id']
    is_valid, missing = CSVImporter.validate_headers(data, required_headers)
    
    if not is_valid:
        result.add_error(0, 'headers', f"Missing required headers: {', '.join(missing)}")
        return result
    
    for idx, row in enumerate(data):
        try:
            student_id = row.get('student_id', '').strip()
            if not student_id:
                result.add_error(idx + 1, 'student_id', 'student_id is required')
                continue
            
            # Find cadet
            try:
                cadet = Cadet.objects.get(student_id=student_id)
                grade, created = Grades.objects.get_or_create(cadet=cadet)
                
                # Update grade fields
                if row.get('attendance_present'):
                    grade.attendance_present = int(row['attendance_present'])
                if row.get('merit_points'):
                    grade.merit_points = int(row['merit_points'])
                if row.get('demerit_points'):
                    grade.demerit_points = int(row['demerit_points'])
                if row.get('prelim_score'):
                    grade.prelim_score = float(row['prelim_score'])
                if row.get('midterm_score'):
                    grade.midterm_score = float(row['midterm_score'])
                if row.get('final_score'):
                    grade.final_score = float(row['final_score'])
                
                grade.save()
                result.add_success(grade.id, created=created)
            
            except Cadet.DoesNotExist:
                result.add_error(idx + 1, 'student_id', f'Cadet not found: {student_id}')
        
        except Exception as e:
            result.add_error(idx + 1, 'exception', str(e), row)
    
    return result


def _import_attendance_from_csv(data, merge_strategy, user_id):
    """Import attendance from CSV data"""
    result = ImportResult()
    
    required_headers = ['student_id', 'training_day_id', 'status']
    is_valid, missing = CSVImporter.validate_headers(data, required_headers)
    
    if not is_valid:
        result.add_error(0, 'headers', f"Missing required headers: {', '.join(missing)}")
        return result
    
    for idx, row in enumerate(data):
        try:
            student_id = row.get('student_id', '').strip()
            training_day_id = row.get('training_day_id', '').strip()
            status_value = row.get('status', '').strip()
            
            if not all([student_id, training_day_id, status_value]):
                result.add_error(idx + 1, 'required_fields', 'Missing required fields')
                continue
            
            # Find cadet and training day
            try:
                cadet = Cadet.objects.get(student_id=student_id)
                training_day = TrainingDay.objects.get(id=int(training_day_id))
                
                # Create or update attendance record
                attendance, created = AttendanceRecord.objects.get_or_create(
                    cadet=cadet,
                    training_day=training_day,
                    defaults={'status': status_value}
                )
                
                if not created and DataMergeStrategy.should_update(merge_strategy, attendance, row):
                    attendance.status = status_value
                    if row.get('time_in'):
                        attendance.time_in = row['time_in']
                    if row.get('time_out'):
                        attendance.time_out = row['time_out']
                    attendance.save()
                
                result.add_success(attendance.id, created=created)
            
            except Cadet.DoesNotExist:
                result.add_error(idx + 1, 'student_id', f'Cadet not found: {student_id}')
            except TrainingDay.DoesNotExist:
                result.add_error(idx + 1, 'training_day_id', f'Training day not found: {training_day_id}')
        
        except Exception as e:
            result.add_error(idx + 1, 'exception', str(e), row)
    
    return result
