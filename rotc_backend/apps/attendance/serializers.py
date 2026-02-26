"""
Serializers for attendance app.
"""
from rest_framework import serializers
from .models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter
from apps.cadets.models import Cadet
from apps.staff.models import TrainingStaff


class TrainingDaySerializer(serializers.ModelSerializer):
    """Serializer for TrainingDay model."""
    
    class Meta:
        model = TrainingDay
        fields = ['id', 'date', 'title', 'description', 'location', 'created_at']
        read_only_fields = ['id', 'created_at']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceRecord model."""
    cadet_name = serializers.SerializerMethodField()
    student_id = serializers.SerializerMethodField()
    
    class Meta:
        model = AttendanceRecord
        fields = ['id', 'training_day', 'cadet', 'cadet_name', 'student_id', 
                  'status', 'time_in', 'time_out', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_cadet_name(self, obj):
        """Get full name of cadet."""
        return f"{obj.cadet.first_name} {obj.cadet.last_name}"
    
    def get_student_id(self, obj):
        """Get student ID of cadet."""
        return obj.cadet.student_id
    
    def validate(self, data):
        """Validate unique constraint on (training_day, cadet)."""
        training_day = data.get('training_day')
        cadet = data.get('cadet')
        
        # Check if this is an update (instance exists)
        if self.instance:
            # Exclude current instance from uniqueness check
            if AttendanceRecord.objects.filter(
                training_day=training_day, 
                cadet=cadet
            ).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError(
                    "Attendance record already exists for this cadet and training day."
                )
        else:
            # For new records, check if combination exists
            if AttendanceRecord.objects.filter(
                training_day=training_day, 
                cadet=cadet
            ).exists():
                raise serializers.ValidationError(
                    "Attendance record already exists for this cadet and training day."
                )
        
        return data


class StaffAttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for StaffAttendanceRecord model."""
    staff_name = serializers.SerializerMethodField()
    
    class Meta:
        model = StaffAttendanceRecord
        fields = ['id', 'training_day', 'staff', 'staff_name', 
                  'time_in', 'time_out', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_staff_name(self, obj):
        """Get full name of staff member."""
        return f"{obj.staff.first_name} {obj.staff.last_name}"
    
    def validate(self, data):
        """Validate unique constraint on (training_day, staff)."""
        training_day = data.get('training_day')
        staff = data.get('staff')
        
        # Check if this is an update (instance exists)
        if self.instance:
            # Exclude current instance from uniqueness check
            if StaffAttendanceRecord.objects.filter(
                training_day=training_day, 
                staff=staff
            ).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError(
                    "Staff attendance record already exists for this staff and training day."
                )
        else:
            # For new records, check if combination exists
            if StaffAttendanceRecord.objects.filter(
                training_day=training_day, 
                staff=staff
            ).exists():
                raise serializers.ValidationError(
                    "Staff attendance record already exists for this staff and training day."
                )
        
        return data


class ExcuseLetterSerializer(serializers.ModelSerializer):
    """Serializer for ExcuseLetter model."""
    cadet_name = serializers.SerializerMethodField()
    student_id = serializers.SerializerMethodField()
    
    class Meta:
        model = ExcuseLetter
        fields = ['id', 'cadet', 'cadet_name', 'student_id', 'training_day', 
                  'date_absent', 'reason', 'file_url', 'ocr_text', 'ocr_confidence', 
                  'ocr_processed_at', 'status', 'created_at']
        read_only_fields = ['id', 'created_at', 'ocr_text', 'ocr_confidence', 'ocr_processed_at']
    
    def get_cadet_name(self, obj):
        """Get full name of cadet."""
        return f"{obj.cadet.first_name} {obj.cadet.last_name}"
    
    def get_student_id(self, obj):
        """Get student ID of cadet."""
        return obj.cadet.student_id


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer for bulk attendance creation."""
    training_day_id = serializers.IntegerField()
    cadet_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
    status = serializers.ChoiceField(
        choices=['present', 'absent', 'late', 'excused'],
        default='present'
    )
    time_in = serializers.TimeField(required=False, allow_null=True)
    time_out = serializers.TimeField(required=False, allow_null=True)
    
    def validate_training_day_id(self, value):
        """Validate training day exists."""
        if not TrainingDay.objects.filter(id=value).exists():
            raise serializers.ValidationError("Training day does not exist.")
        return value
    
    def validate_cadet_ids(self, value):
        """Validate all cadet IDs exist."""
        existing_ids = set(Cadet.objects.filter(id__in=value).values_list('id', flat=True))
        invalid_ids = set(value) - existing_ids
        if invalid_ids:
            raise serializers.ValidationError(
                f"Invalid cadet IDs: {', '.join(map(str, invalid_ids))}"
            )
        return value


class QRCheckInSerializer(serializers.Serializer):
    """Serializer for QR code check-in."""
    training_day_id = serializers.IntegerField()
    cadet_id = serializers.IntegerField()
    qr_code = serializers.CharField(max_length=255)
    
    def validate_training_day_id(self, value):
        """Validate training day exists."""
        if not TrainingDay.objects.filter(id=value).exists():
            raise serializers.ValidationError("Training day does not exist.")
        return value
    
    def validate_cadet_id(self, value):
        """Validate cadet exists."""
        if not Cadet.objects.filter(id=value).exists():
            raise serializers.ValidationError("Cadet does not exist.")
        return value
