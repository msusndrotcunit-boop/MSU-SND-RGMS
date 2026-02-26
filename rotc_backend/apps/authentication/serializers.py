"""
Serializers for authentication app.
"""
from rest_framework import serializers
from apps.authentication.models import User, UserSettings
from apps.cadets.models import Cadet
from apps.staff.models import TrainingStaff
import bcrypt


class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user settings."""
    
    class Meta:
        model = UserSettings
        fields = [
            'email_alerts', 'push_notifications', 'activity_updates',
            'dark_mode', 'compact_mode', 'primary_color', 'custom_bg'
        ]


class CadetBasicSerializer(serializers.ModelSerializer):
    """Basic cadet information for user profile."""
    
    class Meta:
        model = Cadet
        fields = [
            'id', 'student_id', 'first_name', 'last_name', 'middle_name',
            'suffix_name', 'company', 'platoon', 'course', 'year_level',
            'status', 'profile_pic', 'is_profile_completed'
        ]


class TrainingStaffBasicSerializer(serializers.ModelSerializer):
    """Basic training staff information for user profile."""
    
    class Meta:
        model = TrainingStaff
        fields = [
            'id', 'first_name', 'last_name', 'middle_name', 'suffix_name',
            'rank', 'email', 'role', 'profile_pic', 'is_profile_completed'
        ]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    settings = UserSettingsSerializer(read_only=True)
    cadet = serializers.SerializerMethodField()
    staff = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'is_approved',
            'cadet_id', 'staff_id', 'profile_pic', 'created_at',
            'settings', 'cadet', 'staff'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_cadet(self, obj):
        """Get cadet information if user is a cadet."""
        if obj.role == 'cadet' and obj.cadet_id:
            try:
                cadet = Cadet.objects.get(id=obj.cadet_id)
                return CadetBasicSerializer(cadet).data
            except Cadet.DoesNotExist:
                return None
        return None
    
    def get_staff(self, obj):
        """Get staff information if user is training staff."""
        if obj.role == 'training_staff' and obj.staff_id:
            try:
                staff = TrainingStaff.objects.get(id=obj.staff_id)
                return TrainingStaffBasicSerializer(staff).data
            except TrainingStaff.DoesNotExist:
                return None
        return None


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(write_only=True, min_length=6)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role']
    
    def create(self, validated_data):
        """Create a new user with bcrypt hashed password."""
        password = validated_data.pop('password')
        # Hash password using bcrypt
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=10))
        validated_data['password'] = hashed_password.decode('utf-8')
        validated_data['is_approved'] = False  # Default to not approved
        user = User.objects.create(**validated_data)
        
        # Create default user settings
        UserSettings.objects.create(user=user)
        
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for login request."""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class TokenResponseSerializer(serializers.Serializer):
    """Serializer for token response."""
    token = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()
    role = serializers.CharField()
