"""
Views for messaging app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import AdminMessage, StaffMessage, Notification, PushSubscription
from .serializers import (
    AdminMessageSerializer, AdminMessageCreateSerializer,
    StaffMessageSerializer, StaffMessageCreateSerializer,
    NotificationSerializer, NotificationCreateSerializer,
    PushSubscriptionSerializer
)
from apps.authentication.permissions import IsAdmin


class AdminMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for AdminMessage model."""
    queryset = AdminMessage.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return AdminMessageCreateSerializer
        return AdminMessageSerializer
    
    def get_queryset(self):
        """Get admin messages for current user or all if admin."""
        user = self.request.user
        queryset = AdminMessage.objects.select_related('user').all()
        
        # Non-admin users can only see their own messages
        if user.role != 'admin':
            queryset = queryset.filter(user=user)
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['put'], permission_classes=[IsAuthenticated, IsAdmin])
    def reply(self, request, pk=None):
        """Admin reply to a message."""
        message = self.get_object()
        
        admin_reply = request.data.get('admin_reply')
        if not admin_reply:
            return Response(
                {'error': 'admin_reply is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        message.admin_reply = admin_reply
        message.status = 'replied'
        message.save()
        
        # Create notification for user
        Notification.objects.create(
            user=message.user,
            message=f"Admin replied to your message: {message.subject}",
            type='admin_reply'
        )
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)


class StaffMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for StaffMessage model."""
    queryset = StaffMessage.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return StaffMessageCreateSerializer
        return StaffMessageSerializer
    
    def get_queryset(self):
        """Get staff messages ordered by creation time."""
        # Only training staff can access staff messages
        user = self.request.user
        if user.role not in ['admin', 'training_staff']:
            return StaffMessage.objects.none()
        
        return StaffMessage.objects.select_related('sender_staff').order_by('created_at')
    
    def get_permissions(self):
        """Only admin and training staff can access staff messages."""
        if self.action in ['list', 'retrieve', 'create']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for Notification model."""
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get notifications for current user."""
        user = self.request.user
        queryset = Notification.objects.filter(user=user)
        
        # Filter by is_read if provided
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            is_read_bool = is_read.lower() == 'true'
            queryset = queryset.filter(is_read=is_read_bool)
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['put'])
    def mark_read(self, request, pk=None):
        """Mark notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications."""
        user = request.user
        count = Notification.objects.filter(user=user, is_read=False).count()
        
        return Response({'count': count})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for current user."""
        user = request.user
        updated = Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        
        return Response({
            'message': f'{updated} notifications marked as read',
            'count': updated
        })


class PushSubscriptionViewSet(viewsets.ModelViewSet):
    """ViewSet for PushSubscription model."""
    queryset = PushSubscription.objects.all()
    serializer_class = PushSubscriptionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get push subscriptions for current user."""
        user = self.request.user
        return PushSubscription.objects.filter(user=user)
    
    def create(self, request, *args, **kwargs):
        """Create or update push subscription."""
        user = request.user
        endpoint = request.data.get('endpoint')
        
        if not endpoint:
            return Response(
                {'error': 'endpoint is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if subscription already exists for this endpoint
        existing = PushSubscription.objects.filter(user=user, endpoint=endpoint).first()
        
        if existing:
            # Update existing subscription
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        # Create new subscription
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
