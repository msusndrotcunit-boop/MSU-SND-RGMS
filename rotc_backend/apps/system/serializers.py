"""
Serializers for system settings and user settings.
"""
from rest_framework import serializers
from apps.system.models import SystemSettings, AuditLog, SyncEvent
from apps.authentication.models import UserSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    """Serializer for system-wide settings."""
    
    class Meta:
        model = SystemSettings
        fields = ['id', 'key', 'value']
        read_only_fields = ['id']
    
    def validate_key(self, value):
        """Validate that key is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError("Key cannot be empty")
        return value.strip()
    
    def validate(self, data):
        """Validate setting values based on key type."""
        key = data.get('key')
        value = data.get('value')
        
        # Validate maintenance_mode as boolean
        if key == 'maintenance_mode':
            if value.lower() not in ['true', 'false', '0', '1']:
                raise serializers.ValidationError({
                    'value': 'maintenance_mode must be a boolean value (true/false)'
                })
        
        # Validate semester
        if key == 'semester':
            valid_semesters = ['1st', '2nd', 'Summer']
            if value not in valid_semesters:
                raise serializers.ValidationError({
                    'value': f'semester must be one of: {", ".join(valid_semesters)}'
                })
        
        return data


class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user preferences and customization."""
    
    class Meta:
        model = UserSettings
        fields = [
            'id', 'user', 'email_alerts', 'push_notifications',
            'activity_updates', 'dark_mode', 'compact_mode',
            'primary_color', 'custom_bg'
        ]
        read_only_fields = ['id', 'user']
    
    def validate_primary_color(self, value):
        """Validate primary_color against allowed colors."""
        allowed_colors = [
            'blue', 'red', 'green', 'purple', 'orange',
            'pink', 'teal', 'indigo', 'cyan', 'amber'
        ]
        
        if value and value.lower() not in allowed_colors:
            raise serializers.ValidationError(
                f'primary_color must be one of: {", ".join(allowed_colors)}'
            )
        
        return value.lower() if value else 'blue'



class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs."""
    
    class Meta:
        model = AuditLog
        fields = ['id', 'table_name', 'operation', 'record_id', 'user_id', 'payload', 'created_at']
        read_only_fields = ['id', 'created_at']


class SyncEventSerializer(serializers.ModelSerializer):
    """Serializer for sync events."""
    
    class Meta:
        model = SyncEvent
        fields = ['id', 'event_type', 'cadet_id', 'payload', 'processed', 'created_at']
        read_only_fields = ['id', 'created_at']
