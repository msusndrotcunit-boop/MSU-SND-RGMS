"""
Views for activities app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from datetime import datetime

from .models import Activity, ActivityImage
from .serializers import (
    ActivitySerializer, ActivityWithImagesSerializer,
    ActivityCreateUpdateSerializer, ActivityImageSerializer
)
from apps.authentication.permissions import IsAdmin, IsAdminOrTrainingStaff


class ActivityPagination(PageNumberPagination):
    """Custom pagination for activities."""
    page_size = 10
    page_size_query_param = 'limit'
    max_page_size = 100


class ActivityViewSet(viewsets.ModelViewSet):
    """ViewSet for Activity model."""
    queryset = Activity.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = ActivityPagination
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'retrieve':
            return ActivityWithImagesSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ActivityCreateUpdateSerializer
        return ActivitySerializer
    
    def get_permissions(self):
        """Admin and training staff can create/update/delete, all authenticated users can read."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdminOrTrainingStaff()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """Get activities with optional filtering."""
        queryset = Activity.objects.all().order_by('-date')
        
        # Filter by type
        activity_type = self.request.query_params.get('type')
        if activity_type:
            queryset = queryset.filter(type=activity_type)
        
        # Filter by date range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(date__gte=date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(date__lte=date_to_obj)
            except ValueError:
                pass
        
        return queryset
    
    def destroy(self, request, *args, **kwargs):
        """Delete activity with cascade deletion of associated images."""
        instance = self.get_object()
        
        # ActivityImage records will be cascade deleted automatically
        # due to the ForeignKey on_delete=CASCADE
        self.perform_destroy(instance)
        
        return Response(
            {'message': 'Activity deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )
    
    @action(detail=True, methods=['get'])
    def images(self, request, pk=None):
        """Get all images for an activity."""
        activity = self.get_object()
        images = activity.activity_images.all()
        serializer = ActivityImageSerializer(images, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_image(self, request, pk=None):
        """Add an image to an activity."""
        activity = self.get_object()
        
        image_url = request.data.get('image_url')
        if not image_url:
            return Response(
                {'error': 'image_url is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        image = ActivityImage.objects.create(
            activity=activity,
            image_url=image_url
        )
        
        serializer = ActivityImageSerializer(image)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='remove_image/(?P<image_id>[^/.]+)')
    def remove_image(self, request, pk=None, image_id=None):
        """Remove an image from an activity."""
        activity = self.get_object()
        
        try:
            image = ActivityImage.objects.get(id=image_id, activity=activity)
            image.delete()
            return Response(
                {'message': 'Image removed successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
        except ActivityImage.DoesNotExist:
            return Response(
                {'error': 'Image not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class ActivityImageViewSet(viewsets.ModelViewSet):
    """ViewSet for ActivityImage model."""
    queryset = ActivityImage.objects.all()
    serializer_class = ActivityImageSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTrainingStaff]
    
    def get_queryset(self):
        """Get activity images, optionally filtered by activity_id."""
        queryset = ActivityImage.objects.select_related('activity').all()
        
        # Filter by activity_id if provided
        activity_id = self.request.query_params.get('activity_id')
        if activity_id:
            queryset = queryset.filter(activity_id=activity_id)
        
        return queryset
