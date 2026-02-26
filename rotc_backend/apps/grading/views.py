"""
Views for grading system API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
from apps.cadets.models import Grades, Cadet
from apps.grading.models import MeritDemeritLog
from apps.grading.serializers import (
    GradesDetailSerializer,
    GradesUpdateSerializer,
    MeritDemeritLogSerializer,
)
from apps.authentication.permissions import IsAdmin, IsApproved
from core.cache import (
    generate_cache_key,
    get_cached_data,
    set_cached_data,
    get_cache_ttl,
    invalidate_grades_cache,
)


@api_view(['GET'])
@permission_classes([IsApproved])
def grades_list(request):
    """
    Get all grades with cadet information (cached).
    GET /api/grades
    """
    cache_key = generate_cache_key('grades:list')
    
    # Try to get from cache
    cached_response = get_cached_data(cache_key)
    if cached_response is not None:
        return Response(cached_response, status=status.HTTP_200_OK)
    
    # Cache miss - fetch from database
    grades = Grades.objects.select_related('cadet').all()
    serializer = GradesDetailSerializer(grades, many=True)
    
    # Cache the response
    ttl = get_cache_ttl('grades')
    set_cached_data(cache_key, serializer.data, ttl)
    
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@permission_classes([IsApproved])
def grades_detail_or_update(request, cadet_id):
    """
    Get or update grades for a specific cadet.
    GET /api/grades/:cadet_id - Get grades with merit/demerit history (cached)
    PUT /api/grades/:cadet_id - Update grades (Admin only)
    """
    try:
        grades = Grades.objects.select_related('cadet').prefetch_related(
            'cadet__merit_demerit_logs'
        ).get(cadet_id=cadet_id)
    except Grades.DoesNotExist:
        return Response(
            {'error': 'Grades not found for this cadet'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        cache_key = generate_cache_key('grades', cadet_id=cadet_id)
        
        # Try to get from cache
        cached_response = get_cached_data(cache_key)
        if cached_response is not None:
            return Response(cached_response, status=status.HTTP_200_OK)
        
        # Cache miss - serialize and cache
        serializer = GradesDetailSerializer(grades)
        
        # Cache the response
        ttl = get_cache_ttl('grades')
        set_cached_data(cache_key, serializer.data, ttl)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        # Check admin permission for PUT
        if not hasattr(request, 'auth_user') or request.auth_user.role != 'admin':
            return Response(
                {'error': 'Admin permission required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = GradesUpdateSerializer(grades, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        # Invalidate grades cache
        invalidate_grades_cache(cadet_id)
        
        # Return full grades detail
        response_serializer = GradesDetailSerializer(grades)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def merit_demerit_create(request):
    """
    Create a new merit/demerit log entry.
    POST /api/merit-demerit
    """
    serializer = MeritDemeritLogSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # Save the log entry (signal will update grades automatically)
    log_entry = serializer.save()
    
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsApproved])
def merit_demerit_history(request, cadet_id):
    """
    Get merit/demerit history for a specific cadet.
    GET /api/merit-demerit/:cadet_id
    """
    try:
        cadet = Cadet.objects.get(id=cadet_id)
    except Cadet.DoesNotExist:
        return Response(
            {'error': 'Cadet not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    logs = MeritDemeritLog.objects.filter(cadet=cadet).order_by('-date_recorded')
    serializer = MeritDemeritLogSerializer(logs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAdmin])
def merit_demerit_delete(request, log_id):
    """
    Delete a merit/demerit log entry.
    DELETE /api/merit-demerit/:id
    """
    try:
        log_entry = MeritDemeritLog.objects.get(id=log_id)
    except MeritDemeritLog.DoesNotExist:
        return Response(
            {'error': 'Merit/Demerit log not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Delete the log entry (signal will update grades automatically)
    log_entry.delete()
    
    return Response({
        'message': 'Merit/Demerit log deleted successfully'
    }, status=status.HTTP_200_OK)
