"""
Attendance models for ROTC Backend.
Includes TrainingDay, AttendanceRecord, StaffAttendanceRecord, and ExcuseLetter models.
"""
from django.db import models
from apps.cadets.models import Cadet


class TrainingDay(models.Model):
    """
    Training day/session model.
    Matches the 'training_days' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'training_days'
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.title} - {self.date}"


class AttendanceRecord(models.Model):
    """
    Cadet attendance record for training days.
    Matches the 'attendance_records' table from Node.js backend.
    """
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]
    
    id = models.AutoField(primary_key=True)
    training_day = models.ForeignKey(TrainingDay, on_delete=models.CASCADE, related_name='attendance_records')
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, related_name='attendance_records')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'attendance_records'
        unique_together = [['training_day', 'cadet']]
        indexes = [
            models.Index(fields=['training_day', 'status']),
        ]
    
    def __str__(self):
        return f"{self.cadet.student_id} - {self.training_day.title} ({self.status})"


class StaffAttendanceRecord(models.Model):
    """
    Training staff attendance record for training days.
    Matches the 'staff_attendance_records' table from Node.js backend.
    Note: TrainingStaff model will be created in the staff app.
    """
    id = models.AutoField(primary_key=True)
    training_day = models.ForeignKey(TrainingDay, on_delete=models.CASCADE, related_name='staff_attendance')
    staff = models.ForeignKey('staff.TrainingStaff', on_delete=models.CASCADE, related_name='attendance_records')
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'staff_attendance_records'
        unique_together = [['training_day', 'staff']]
    
    def __str__(self):
        return f"Staff {self.staff.id} - {self.training_day.title}"


class ExcuseLetter(models.Model):
    """
    Excuse letter submissions for absences.
    Matches the 'excuse_letters' table from Node.js backend.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    id = models.AutoField(primary_key=True)
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, related_name='excuse_letters')
    training_day = models.ForeignKey(TrainingDay, on_delete=models.SET_NULL, null=True, blank=True)
    date_absent = models.DateField()
    reason = models.TextField()
    file_url = models.TextField(null=True, blank=True)
    ocr_text = models.TextField(null=True, blank=True, help_text='Extracted text from OCR processing')
    ocr_confidence = models.FloatField(null=True, blank=True, help_text='OCR confidence score (0-100)')
    ocr_processed_at = models.DateTimeField(null=True, blank=True, help_text='When OCR was processed')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'excuse_letters'
        indexes = [
            models.Index(fields=['cadet', 'status']),
        ]
    
    def __str__(self):
        return f"Excuse letter for {self.cadet.student_id} - {self.date_absent}"
