"""
Serializers for Cadet and Grades models.
"""
from rest_framework import serializers
from apps.cadets.models import Cadet, Grades
from django.db import transaction


class GradesSerializer(serializers.ModelSerializer):
    """Serializer for Grades model."""
    
    class Meta:
        model = Grades
        fields = [
            'id', 'cadet', 'attendance_present', 'merit_points',
            'demerit_points', 'prelim_score', 'midterm_score', 'final_score'
        ]
        read_only_fields = ['id', 'cadet']


class CadetSerializer(serializers.ModelSerializer):
    """Serializer for Cadet model with all fields."""
    
    class Meta:
        model = Cadet
        fields = [
            'id', 'student_id', 'first_name', 'last_name', 'middle_name',
            'suffix_name', 'company', 'platoon', 'course', 'year_level',
            'status', 'profile_pic', 'contact_number', 'email', 'birthdate',
            'birthplace', 'age', 'height', 'weight', 'blood_type', 'address',
            'civil_status', 'nationality', 'gender', 'language_spoken',
            'combat_boots_size', 'uniform_size', 'bullcap_size', 'facebook_link',
            'rotc_unit', 'mobilization_center', 'is_profile_completed',
            'is_archived', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate_student_id(self, value):
        """Validate that student_id is unique."""
        if self.instance:
            # Update case - exclude current instance
            if Cadet.objects.exclude(pk=self.instance.pk).filter(student_id=value).exists():
                raise serializers.ValidationError("Student ID already exists.")
        else:
            # Create case
            if Cadet.objects.filter(student_id=value).exists():
                raise serializers.ValidationError("Student ID already exists.")
        return value
    
    def validate(self, data):
        """Validate required fields."""
        if not self.instance:  # Only for creation
            required_fields = ['first_name', 'last_name', 'student_id']
            for field in required_fields:
                if field not in data or not data[field]:
                    raise serializers.ValidationError({field: "This field is required."})
        return data


class CadetWithGradesSerializer(serializers.ModelSerializer):
    """Serializer for Cadet with nested Grades."""
    grades = GradesSerializer(read_only=True)
    
    class Meta:
        model = Cadet
        fields = [
            'id', 'student_id', 'first_name', 'last_name', 'middle_name',
            'suffix_name', 'company', 'platoon', 'course', 'year_level',
            'status', 'profile_pic', 'contact_number', 'email', 'birthdate',
            'birthplace', 'age', 'height', 'weight', 'blood_type', 'address',
            'civil_status', 'nationality', 'gender', 'language_spoken',
            'combat_boots_size', 'uniform_size', 'bullcap_size', 'facebook_link',
            'rotc_unit', 'mobilization_center', 'is_profile_completed',
            'is_archived', 'created_at', 'grades'
        ]
        read_only_fields = ['id', 'created_at', 'grades']


class CadetCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new Cadet with automatic Grades creation."""
    
    class Meta:
        model = Cadet
        fields = [
            'student_id', 'first_name', 'last_name', 'middle_name',
            'suffix_name', 'company', 'platoon', 'course', 'year_level',
            'status', 'profile_pic', 'contact_number', 'email', 'birthdate',
            'birthplace', 'age', 'height', 'weight', 'blood_type', 'address',
            'civil_status', 'nationality', 'gender', 'language_spoken',
            'combat_boots_size', 'uniform_size', 'bullcap_size', 'facebook_link',
            'rotc_unit', 'mobilization_center', 'is_profile_completed'
        ]
    
    def validate_student_id(self, value):
        """Validate that student_id is unique."""
        if Cadet.objects.filter(student_id=value).exists():
            raise serializers.ValidationError("Student ID already exists.")
        return value
    
    def validate(self, data):
        """Validate required fields."""
        required_fields = ['first_name', 'last_name', 'student_id']
        for field in required_fields:
            if field not in data or not data[field]:
                raise serializers.ValidationError({field: "This field is required."})
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        """Create Cadet and automatically create associated Grades record."""
        cadet = Cadet.objects.create(**validated_data)
        # Automatically create Grades record
        Grades.objects.create(cadet=cadet)
        return cadet
