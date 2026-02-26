"""
Serializers for messaging app.
"""
from rest_framework import serializers
from .models import AdminMessage, StaffMessage, Notification, PushSubscription
from apps.authentication.models import User
from apps.staff.models import TrainingStaff


class AdminMessageSerializer(serializers.ModelSerializer):
    """Serializer for AdminMessage model."""
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    
    class Meta:
        model = AdminMessage
        fields = ['id', 'user', 'user_name', 'user_email', 'subject', 
                  'message', 'status', 'admin_reply', 'created_at']
        read_only_fields = ['id', 'created_at', 'user_name', 'user_email']
    
    def get_user_name(self, obj):
        """Get username of message sender."""
        return obj.user.username
    
    def get_user_email(self, obj):
        """Get email of message sender."""
        return obj.user.email


class AdminMessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating admin messages."""
    
    class Meta:
        model = AdminMessage
        fields = ['subject', 'message']
    
    def create(self, validated_data):
        """Create admin message with current user."""
        user = self.context['request'].user
        return AdminMessage.objects.create(user=user, **validated_data)


class StaffMessageSerializer(serializers.ModelSerializer):
    """Serializer for StaffMessage model."""
    sender_name = serializers.SerializerMethodField()
    sender_rank = serializers.SerializerMethodField()
    
    class Meta:
        model = StaffMessage
        fields = ['id', 'sender_staff', 'sender_name', 'sender_rank', 
                  'content', 'created_at']
        read_only_fields = ['id', 'created_at', 'sender_name', 'sender_rank']
    
    def get_sender_name(self, obj):
        """Get full name of sender."""
        return f"{obj.sender_staff.first_name} {obj.sender_staff.last_name}"
    
    def get_sender_rank(self, obj):
        """Get rank of sender."""
        return obj.sender_staff.rank


class StaffMessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating staff messages."""
    
    class Meta:
        model = StaffMessage
        fields = ['content']
    
    def validate(self, data):
        """Validate that current user is a staff member."""
        user = self.context['request'].user
        
        if user.role != 'training_staff' or not user.staff_id:
            raise serializers.ValidationError(
                "Only training staff members can send staff messages."
            )
        
        return data
    
    def create(self, validated_data):
        """Create staff message with current user's staff ID."""
        user = self.context['request'].user
        
        try:
            staff = TrainingStaff.objects.get(id=user.staff_id)
        except TrainingStaff.DoesNotExist:
            raise serializers.ValidationError("Staff profile not found.")
        
        return StaffMessage.objects.create(sender_staff=staff, **validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""
    
    class Meta:
        model = Notification
        fields = ['id', 'user', 'message', 'type', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications."""
    
    class Meta:
        model = Notification
        fields = ['user', 'message', 'type']


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for PushSubscription model."""
    
    class Meta:
        model = PushSubscription
        fields = ['id', 'user', 'endpoint', 'keys', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate_keys(self, value):
        """Validate keys field has required fields."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Keys must be a dictionary.")
        
        if 'p256dh' not in value or 'auth' not in value:
            raise serializers.ValidationError(
                "Keys must contain 'p256dh' and 'auth' fields."
            )
        
        return value
