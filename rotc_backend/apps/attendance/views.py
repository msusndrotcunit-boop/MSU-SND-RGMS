"""
Views for attendance app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
import hashlib
import json

from .models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter
from .serializers import (
    TrainingDaySerializer, AttendanceRecordSerializer, 
    StaffAttendanceRecordSerializer, ExcuseLetterSerializer,
    BulkAttendanceSerializer, QRCheckInSerializer
)
from apps.cadets.models import Cadet
from apps.authentication.permissions import IsAdmin, IsAdminOrTrainingStaff
from core.cache import (
    generate_cache_key,
    get_cached_data,
    set_cached_data,
    get_cache_ttl,
    invalidate_training_day_cache,
)


class TrainingDayViewSet(viewsets.ModelViewSet):
    """ViewSet for TrainingDay model."""
    queryset = TrainingDay.objects.all()
    serializer_class = TrainingDaySerializer
    permission_classes = [IsAuthenticated, IsAdminOrTrainingStaff]
    
    def get_queryset(self):
        """Get training days ordered by date (most recent first)."""
        return TrainingDay.objects.all().order_by('-date')
    
    def list(self, request, *args, **kwargs):
        """List training days with caching."""
        cache_key = generate_cache_key('training_days:list')
        
        # Try to get from cache
        cached_response = get_cached_data(cache_key)
        if cached_response is not None:
            return Response(cached_response, status=status.HTTP_200_OK)
        
        # Cache miss - fetch from database
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Cache the response
        ttl = get_cache_ttl('training_days')
        set_cached_data(cache_key, serializer.data, ttl)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def create(self, request, *args, **kwargs):
        """Create training day and invalidate cache."""
        response = super().create(request, *args, **kwargs)
        invalidate_training_day_cache()
        return response
    
    def update(self, request, *args, **kwargs):
        """Update training day and invalidate cache."""
        response = super().update(request, *args, **kwargs)
        invalidate_training_day_cache()
        return response
    
    def destroy(self, request, *args, **kwargs):
        """Delete training day and invalidate cache."""
        response = super().destroy(request, *args, **kwargs)
        invalidate_training_day_cache()
        return response
    
    @action(detail=True, methods=['get'])
    def qr_code(self, request, pk=None):
        """Generate QR code data for training day check-in."""
        training_day = self.get_object()
        
        # Generate QR code data (hash of training day ID and date)
        qr_data = f"{training_day.id}:{training_day.date}:{training_day.title}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:16]
        
        return Response({
            'training_day_id': training_day.id,
            'qr_code': qr_hash,
            'title': training_day.title,
            'date': training_day.date
        })


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    """ViewSet for AttendanceRecord model."""
    queryset = AttendanceRecord.objects.all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTrainingStaff]
    
    def get_queryset(self):
        """Get attendance records, optionally filtered by training_day_id."""
        queryset = AttendanceRecord.objects.select_related('cadet', 'training_day').all()
        
        # Filter by training_day_id if provided
        training_day_id = self.request.query_params.get('training_day_id')
        if training_day_id:
            queryset = queryset.filter(training_day_id=training_day_id)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create attendance records for multiple cadets using bulk_create."""
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        training_day_id = serializer.validated_data['training_day_id']
        cadet_ids = serializer.validated_data['cadet_ids']
        status_value = serializer.validated_data['status']
        time_in = serializer.validated_data.get('time_in')
        time_out = serializer.validated_data.get('time_out')
        
        training_day = TrainingDay.objects.get(id=training_day_id)
        
        # Get existing attendance records to avoid duplicates
        existing_cadet_ids = set(
            AttendanceRecord.objects.filter(
                training_day_id=training_day_id,
                cadet_id__in=cadet_ids
            ).values_list('cadet_id', flat=True)
        )
        
        # Create attendance records for cadets without existing records
        records_to_create = []
        for cadet_id in cadet_ids:
            if cadet_id not in existing_cadet_ids:
                records_to_create.append(
                    AttendanceRecord(
                        training_day=training_day,
                        cadet_id=cadet_id,
                        status=status_value,
                        time_in=time_in,
                        time_out=time_out
                    )
                )
        
        # Bulk create records
        created_records = AttendanceRecord.objects.bulk_create(
            records_to_create,
            batch_size=100
        )
        
        # Serialize created records
        response_serializer = AttendanceRecordSerializer(created_records, many=True)
        
        return Response({
            'created': len(created_records),
            'skipped': len(existing_cadet_ids),
            'records': response_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def qr_checkin(self, request):
        """QR code check-in for attendance."""
        serializer = QRCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        training_day_id = serializer.validated_data['training_day_id']
        cadet_id = serializer.validated_data['cadet_id']
        qr_code = serializer.validated_data['qr_code']
        
        # Validate QR code
        training_day = TrainingDay.objects.get(id=training_day_id)
        qr_data = f"{training_day.id}:{training_day.date}:{training_day.title}"
        expected_qr = hashlib.sha256(qr_data.encode()).hexdigest()[:16]
        
        if qr_code != expected_qr:
            return Response(
                {'error': 'Invalid QR code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if attendance record already exists
        existing_record = AttendanceRecord.objects.filter(
            training_day_id=training_day_id,
            cadet_id=cadet_id
        ).first()
        
        if existing_record:
            # Update existing record
            existing_record.status = 'present'
            existing_record.time_in = timezone.now().time()
            existing_record.save()
            record = existing_record
        else:
            # Create new attendance record
            record = AttendanceRecord.objects.create(
                training_day=training_day,
                cadet_id=cadet_id,
                status='present',
                time_in=timezone.now().time()
            )
        
        response_serializer = AttendanceRecordSerializer(record)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class StaffAttendanceRecordViewSet(viewsets.ModelViewSet):
    """ViewSet for StaffAttendanceRecord model."""
    queryset = StaffAttendanceRecord.objects.all()
    serializer_class = StaffAttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTrainingStaff]
    
    def get_queryset(self):
        """Get staff attendance records, optionally filtered by training_day_id."""
        queryset = StaffAttendanceRecord.objects.select_related('staff', 'training_day').all()
        
        # Filter by training_day_id if provided
        training_day_id = self.request.query_params.get('training_day_id')
        if training_day_id:
            queryset = queryset.filter(training_day_id=training_day_id)
        
        return queryset


class ExcuseLetterViewSet(viewsets.ModelViewSet):
    """ViewSet for ExcuseLetter model."""
    queryset = ExcuseLetter.objects.all()
    serializer_class = ExcuseLetterSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get excuse letters, optionally filtered by cadet_id or status."""
        queryset = ExcuseLetter.objects.select_related('cadet', 'training_day').all()
        
        # Filter by cadet_id if provided
        cadet_id = self.request.query_params.get('cadet_id')
        if cadet_id:
            queryset = queryset.filter(cadet_id=cadet_id)
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')

    @action(detail=True, methods=['post'], url_path='process-ocr')
    def process_ocr(self, request, pk=None):
        """
        Trigger OCR processing for an excuse letter.
        
        POST /api/excuse-letters/{id}/process-ocr/
        
        Returns:
        - task_id: Celery task ID for tracking
        - message: Status message
        """
        excuse_letter = self.get_object()
        
        # Check if file_url exists
        if not excuse_letter.file_url:
            return Response(
                {'error': 'No file attached to this excuse letter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already processed
        if excuse_letter.ocr_text and excuse_letter.ocr_processed_at:
            return Response(
                {
                    'message': 'OCR already processed',
                    'ocr_text': excuse_letter.ocr_text,
                    'ocr_confidence': excuse_letter.ocr_confidence,
                    'ocr_processed_at': excuse_letter.ocr_processed_at
                },
                status=status.HTTP_200_OK
            )
        
        # Queue OCR processing task
        from apps.files.tasks import process_ocr_document
        task = process_ocr_document.apply_async(
            args=[excuse_letter.file_url, excuse_letter.id]
        )
        
        return Response(
            {
                'task_id': task.id,
                'message': 'OCR processing queued',
                'excuse_letter_id': excuse_letter.id
            },
            status=status.HTTP_202_ACCEPTED
        )
