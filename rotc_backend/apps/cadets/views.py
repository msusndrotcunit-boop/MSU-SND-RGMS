"""
Views for Cadet management API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from apps.cadets.models import Cadet, Grades
from apps.cadets.serializers import (
    CadetSerializer,
    CadetWithGradesSerializer,
    CadetCreateSerializer,
)
from apps.authentication.permissions import IsAdmin, IsApproved
from core.cache import (
    generate_cache_key,
    get_cached_data,
    set_cached_data,
    get_cache_ttl,
    invalidate_cadet_cache,
)


class CadetPagination(PageNumberPagination):
    """Custom pagination for cadet list."""
    page_size = 50
    page_size_query_param = 'limit'
    max_page_size = 100
    
    def get_paginated_response(self, data):
        """Return paginated response with total count."""
        return Response({
            'results': data,
            'page': self.page.number,
            'limit': self.page_size,
            'total': self.page.paginator.count,
        })


@api_view(['GET', 'POST'])
@permission_classes([IsApproved])
def cadet_list_create(request):
    """
    Get list of all non-archived cadets or create a new cadet.
    GET /api/cadets - List cadets with filtering and search (cached)
    POST /api/cadets - Create new cadet (Admin only)
    Query params: company, platoon, course, year_level, status, search, page, limit
    """
    if request.method == 'GET':
        # Generate cache key based on query parameters
        cache_params = {
            'company': request.query_params.get('company', ''),
            'platoon': request.query_params.get('platoon', ''),
            'course': request.query_params.get('course', ''),
            'year_level': request.query_params.get('year_level', ''),
            'status': request.query_params.get('status', ''),
            'search': request.query_params.get('search', ''),
            'page': request.query_params.get('page', '1'),
            'limit': request.query_params.get('limit', '50'),
        }
        
        cache_key = generate_cache_key('cadets:list', **cache_params)
        
        # Try to get from cache
        cached_response = get_cached_data(cache_key)
        if cached_response is not None:
            return Response(cached_response, status=status.HTTP_200_OK)
        
        # Cache miss - fetch from database
        queryset = Cadet.objects.filter(is_archived=False).select_related('grades')
        
        # Filtering
        company = request.query_params.get('company')
        if company:
            queryset = queryset.filter(company=company)
        
        platoon = request.query_params.get('platoon')
        if platoon:
            queryset = queryset.filter(platoon=platoon)
        
        course = request.query_params.get('course')
        if course:
            queryset = queryset.filter(course=course)
        
        year_level = request.query_params.get('year_level')
        if year_level:
            queryset = queryset.filter(year_level=year_level)
        
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Search by name or student_id
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(student_id__icontains=search)
            )
        
        # Order by created_at descending
        queryset = queryset.order_by('-created_at')
        
        # Pagination
        paginator = CadetPagination()
        page = paginator.paginate_queryset(queryset, request)
        
        if page is not None:
            serializer = CadetWithGradesSerializer(page, many=True)
            response_data = {
                'results': serializer.data,
                'page': paginator.page.number,
                'limit': paginator.page_size,
                'total': paginator.page.paginator.count,
            }
        else:
            serializer = CadetWithGradesSerializer(queryset, many=True)
            response_data = serializer.data
        
        # Cache the response
        ttl = get_cache_ttl('cadet_list')
        set_cached_data(cache_key, response_data, ttl)
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        # Check admin permission for POST
        if not hasattr(request, 'auth_user') or request.auth_user.role != 'admin':
            return Response(
                {'error': 'Admin permission required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = CadetCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        cadet = serializer.save()
        
        # Invalidate cadet cache
        invalidate_cadet_cache()
        
        # Return cadet with grades
        response_serializer = CadetWithGradesSerializer(cadet)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsApproved])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def cadet_detail_update_delete(request, cadet_id):
    """
    Get, update, or delete a cadet.
    GET /api/cadets/:id - Get single cadet with grades
    PUT /api/cadets/:id - Update cadet (Admin only)
    DELETE /api/cadets/:id - Soft delete cadet (Admin only)
    """
    try:
        cadet = Cadet.objects.select_related('grades').get(id=cadet_id)
    except Cadet.DoesNotExist:
        return Response(
            {'error': 'Cadet not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        serializer = CadetWithGradesSerializer(cadet)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        # Check admin permission for PUT
        if not hasattr(request, 'auth_user') or request.auth_user.role != 'admin':
            return Response(
                {'error': 'Admin permission required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Handle profile picture upload if provided
        if 'profile_pic' in request.FILES:
            from apps.files.services import upload_to_cloudinary
            try:
                # Upload profile picture to Cloudinary
                result = upload_to_cloudinary(
                    request.FILES['profile_pic'],
                    'profile_pic',
                    cadet_id
                )
                # Update request data with Cloudinary URL
                request.data._mutable = True
                request.data['profile_pic'] = result['url']
                request.data._mutable = False
            except ValueError as e:
                return Response(
                    {'error': f'Profile picture upload failed: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                return Response(
                    {'error': f'Profile picture upload failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        serializer = CadetSerializer(cadet, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        # Invalidate cadet cache
        invalidate_cadet_cache(cadet_id)
        
        # Return cadet with grades
        response_serializer = CadetWithGradesSerializer(cadet)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'DELETE':
        # Check admin permission for DELETE
        if not hasattr(request, 'auth_user') or request.auth_user.role != 'admin':
            return Response(
                {'error': 'Admin permission required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        cadet.is_archived = True
        cadet.save()
        
        # Invalidate cadet cache
        invalidate_cadet_cache(cadet_id)
        
        return Response({
            'message': 'Cadet archived successfully',
            'is_archived': True
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def cadet_archived_list(request):
    """
    Get list of archived cadets.
    GET /api/cadets/archived
    """
    queryset = Cadet.objects.filter(is_archived=True).select_related('grades').order_by('-created_at')
    
    # Pagination
    paginator = CadetPagination()
    page = paginator.paginate_queryset(queryset, request)
    
    if page is not None:
        serializer = CadetWithGradesSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    serializer = CadetWithGradesSerializer(queryset, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)



@api_view(['POST'])
@permission_classes([IsAdmin])
def cadet_restore(request, cadet_id):
    """
    Restore an archived cadet (set is_archived=False).
    POST /api/cadets/:id/restore
    """
    try:
        cadet = Cadet.objects.get(id=cadet_id)
    except Cadet.DoesNotExist:
        return Response(
            {'error': 'Cadet not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    cadet.is_archived = False
    cadet.save()
    
    # Invalidate cadet cache
    invalidate_cadet_cache(cadet_id)
    
    response_serializer = CadetWithGradesSerializer(cadet)
    return Response(response_serializer.data, status=status.HTTP_200_OK)
