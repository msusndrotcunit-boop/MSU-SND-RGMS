"""
Serializers for grading app.
"""
from rest_framework import serializers
from apps.grading.models import MeritDemeritLog
from apps.cadets.models import Grades, Cadet


class MeritDemeritLogSerializer(serializers.ModelSerializer):
    """Serializer for MeritDemeritLog model."""
    cadet_name = serializers.SerializerMethodField()
    
    class Meta:
        model = MeritDemeritLog
        fields = [
            'id', 'cadet', 'cadet_name', 'type', 'points', 'reason',
            'issued_by_user_id', 'issued_by_name', 'date_recorded'
        ]
        read_only_fields = ['id', 'date_recorded']
    
    def get_cadet_name(self, obj):
        """Get cadet full name."""
        return f"{obj.cadet.first_name} {obj.cadet.last_name}"
    
    def validate_points(self, value):
        """Validate that points are positive."""
        if value <= 0:
            raise serializers.ValidationError("Points must be a positive integer.")
        return value
    
    def validate_type(self, value):
        """Validate type is either merit or demerit."""
        if value not in ['merit', 'demerit']:
            raise serializers.ValidationError("Type must be either 'merit' or 'demerit'.")
        return value


class GradesDetailSerializer(serializers.ModelSerializer):
    """Serializer for Grades with merit/demerit history."""
    cadet_info = serializers.SerializerMethodField()
    merit_demerit_logs = MeritDemeritLogSerializer(
        source='cadet.merit_demerit_logs',
        many=True,
        read_only=True
    )
    
    class Meta:
        model = Grades
        fields = [
            'id', 'cadet', 'cadet_info', 'attendance_present',
            'merit_points', 'demerit_points', 'prelim_score',
            'midterm_score', 'final_score', 'merit_demerit_logs'
        ]
        read_only_fields = ['id', 'cadet']
    
    def get_cadet_info(self, obj):
        """Get basic cadet information."""
        return {
            'id': obj.cadet.id,
            'student_id': obj.cadet.student_id,
            'first_name': obj.cadet.first_name,
            'last_name': obj.cadet.last_name,
            'company': obj.cadet.company,
            'platoon': obj.cadet.platoon,
        }


class GradesUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating grades."""
    
    class Meta:
        model = Grades
        fields = [
            'attendance_present', 'merit_points', 'demerit_points',
            'prelim_score', 'midterm_score', 'final_score'
        ]
    
    def validate_prelim_score(self, value):
        """Validate prelim score range."""
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Score must be between 0 and 100.")
        return value
    
    def validate_midterm_score(self, value):
        """Validate midterm score range."""
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Score must be between 0 and 100.")
        return value
    
    def validate_final_score(self, value):
        """Validate final score range."""
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Score must be between 0 and 100.")
        return value
