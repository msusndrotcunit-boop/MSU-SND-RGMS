"""
Serializers for staff app.
"""
from rest_framework import serializers
from .models import TrainingStaff
from apps.authentication.models import User


class TrainingStaffSerializer(serializers.ModelSerializer):
    """Serializer for TrainingStaff model."""
    
    class Meta:
        model = TrainingStaff
        fields = [
            'id', 'first_name', 'last_name', 'middle_name', 'suffix_name',
            'rank', 'email', 'contact_number', 'role', 'profile_pic', 'afpsn',
            'birthdate', 'birthplace', 'age', 'height', 'weight', 'blood_type',
            'address', 'civil_status', 'nationality', 'gender', 'language_spoken',
            'combat_boots_size', 'uniform_size', 'bullcap_size', 'facebook_link',
            'rotc_unit', 'mobilization_center', 'is_profile_completed',
            'has_seen_guide', 'is_archived', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate_email(self, value):
        """Validate email uniqueness."""
        # Check if this is an update (instance exists)
        if self.instance:
            # Exclude current instance from uniqueness check
            if TrainingStaff.objects.filter(email=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("A staff member with this email already exists.")
        else:
            # For new records, check if email exists
            if TrainingStaff.objects.filter(email=value).exists():
                raise serializers.ValidationError("A staff member with this email already exists.")
        
        return value


class StaffWithUserSerializer(serializers.ModelSerializer):
    """Serializer for TrainingStaff with associated user account data."""
    user = serializers.SerializerMethodField()
    
    class Meta:
        model = TrainingStaff
        fields = [
            'id', 'first_name', 'last_name', 'middle_name', 'suffix_name',
            'rank', 'email', 'contact_number', 'role', 'profile_pic', 'afpsn',
            'birthdate', 'birthplace', 'age', 'height', 'weight', 'blood_type',
            'address', 'civil_status', 'nationality', 'gender', 'language_spoken',
            'combat_boots_size', 'uniform_size', 'bullcap_size', 'facebook_link',
            'rotc_unit', 'mobilization_center', 'is_profile_completed',
            'has_seen_guide', 'is_archived', 'created_at', 'user'
        ]
        read_only_fields = ['id', 'created_at', 'user']
    
    def get_user(self, obj):
        """Get associated user account if exists."""
        try:
            user = User.objects.get(staff_id=obj.id)
            return {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'is_approved': user.is_approved
            }
        except User.DoesNotExist:
            return None


class StaffCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating staff with optional user account."""
    create_user_account = serializers.BooleanField(default=False, write_only=True)
    username = serializers.CharField(max_length=255, required=False, write_only=True)
    password = serializers.CharField(max_length=255, required=False, write_only=True)
    
    class Meta:
        model = TrainingStaff
        fields = [
            'id', 'first_name', 'last_name', 'middle_name', 'suffix_name',
            'rank', 'email', 'contact_number', 'role', 'profile_pic', 'afpsn',
            'birthdate', 'birthplace', 'age', 'height', 'weight', 'blood_type',
            'address', 'civil_status', 'nationality', 'gender', 'language_spoken',
            'combat_boots_size', 'uniform_size', 'bullcap_size', 'facebook_link',
            'rotc_unit', 'mobilization_center', 'is_profile_completed',
            'has_seen_guide', 'create_user_account', 'username', 'password'
        ]
        read_only_fields = ['id']
    
    def validate(self, data):
        """Validate user account creation fields."""
        create_user = data.get('create_user_account', False)
        
        if create_user:
            if not data.get('username'):
                raise serializers.ValidationError({
                    'username': 'Username is required when creating user account.'
                })
            if not data.get('password'):
                raise serializers.ValidationError({
                    'password': 'Password is required when creating user account.'
                })
            
            # Check if username already exists
            if User.objects.filter(username=data['username']).exists():
                raise serializers.ValidationError({
                    'username': 'A user with this username already exists.'
                })
        
        return data
    
    def create(self, validated_data):
        """Create staff and optionally create user account."""
        create_user = validated_data.pop('create_user_account', False)
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        
        # Create staff record
        staff = TrainingStaff.objects.create(**validated_data)
        
        # Create user account if requested
        if create_user and username and password:
            import bcrypt
            
            # Hash password with bcrypt
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            User.objects.create(
                username=username,
                email=staff.email,
                password=hashed_password,
                role='training_staff',
                staff_id=staff.id,
                is_approved=True  # Auto-approve staff accounts
            )
        
        return staff
