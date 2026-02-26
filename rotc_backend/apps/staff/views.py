"""
Views for staff app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import TrainingStaff
from .serializers import (
    TrainingStaffSerializer, StaffWithUserSerializer, StaffCreateSerializer
)
from apps.authentication.permissions import IsAdmin, IsAdminOrTrainingStaff


class TrainingStaffViewSet(viewsets.ModelViewSet):
    """ViewSet for TrainingStaff model."""
    queryset = TrainingStaff.objects.all()
    permission_classes = [IsAuthenticated, IsAdminOrTrainingStaff]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return StaffCreateSerializer
        elif self.action == 'retrieve':
            return StaffWithUserSerializer
        return TrainingStaffSerializer
    
    def get_queryset(self):
        """Get staff members, optionally filtered."""
        queryset = TrainingStaff.objects.all()
        
        # Exclude archived by default
        include_archived = self.request.query_params.get('include_archived', 'false')
        if include_archived.lower() != 'true':
            queryset = queryset.filter(is_archived=False)
        
        # Filter by role
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        
        return queryset.order_by('-created_at')
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete staff member by setting is_archived=True."""
        instance = self.get_object()
        instance.is_archived = True
        instance.save()
        
        return Response(
            {
                'message': 'Staff member archived successfully',
                'is_archived': True
            },
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore archived staff member."""
        staff = self.get_object()
        
        if not staff.is_archived:
            return Response(
                {'message': 'Staff member is not archived'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        staff.is_archived = False
        staff.save()
        
        serializer = self.get_serializer(staff)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def archived(self, request):
        """Get all archived staff members."""
        archived_staff = TrainingStaff.objects.filter(is_archived=True).order_by('-created_at')
        
        page = self.paginate_queryset(archived_staff)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(archived_staff, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def upload_profile_picture(self, request, pk=None):
        """Upload profile picture for staff member."""
        staff = self.get_object()
        
        profile_pic_url = request.data.get('profile_pic')
        if not profile_pic_url:
            return Response(
                {'error': 'profile_pic URL is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        staff.profile_pic = profile_pic_url
        staff.save()
        
        serializer = self.get_serializer(staff)
        return Response(serializer.data)
