"""
Cadet and Grades models for ROTC Backend.
Matches the 'cadets' and 'grades' tables from Node.js backend.
"""
from django.db import models


class Cadet(models.Model):
    """
    Cadet model with comprehensive profile information.
    Matches the 'cadets' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    student_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    middle_name = models.CharField(max_length=255, null=True, blank=True)
    suffix_name = models.CharField(max_length=50, null=True, blank=True)
    company = models.CharField(max_length=50, null=True, blank=True)
    platoon = models.CharField(max_length=50, null=True, blank=True)
    course = models.CharField(max_length=255, null=True, blank=True)
    year_level = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Ongoing')
    profile_pic = models.TextField(null=True, blank=True)
    contact_number = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    birthdate = models.DateField(null=True, blank=True)
    birthplace = models.CharField(max_length=255, null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)
    height = models.CharField(max_length=50, null=True, blank=True)
    weight = models.CharField(max_length=50, null=True, blank=True)
    blood_type = models.CharField(max_length=10, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    civil_status = models.CharField(max_length=50, null=True, blank=True)
    nationality = models.CharField(max_length=100, null=True, blank=True)
    gender = models.CharField(max_length=20, null=True, blank=True)
    language_spoken = models.CharField(max_length=255, null=True, blank=True)
    combat_boots_size = models.CharField(max_length=20, null=True, blank=True)
    uniform_size = models.CharField(max_length=20, null=True, blank=True)
    bullcap_size = models.CharField(max_length=20, null=True, blank=True)
    facebook_link = models.TextField(null=True, blank=True)
    rotc_unit = models.CharField(max_length=255, null=True, blank=True)
    mobilization_center = models.CharField(max_length=255, null=True, blank=True)
    is_profile_completed = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'cadets'
        indexes = [
            models.Index(fields=['student_id']),
            models.Index(fields=['company', 'platoon']),
            models.Index(fields=['is_archived']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.student_id})"


class Grades(models.Model):
    """
    Grades model for tracking cadet academic and performance scores.
    Matches the 'grades' table from Node.js backend.
    One-to-one relationship with Cadet.
    """
    id = models.AutoField(primary_key=True)
    cadet = models.OneToOneField(Cadet, on_delete=models.CASCADE, related_name='grades')
    attendance_present = models.IntegerField(default=0)
    merit_points = models.IntegerField(default=0)
    demerit_points = models.IntegerField(default=0)
    prelim_score = models.FloatField(null=True, blank=True)
    midterm_score = models.FloatField(null=True, blank=True)
    final_score = models.FloatField(null=True, blank=True)
    
    class Meta:
        db_table = 'grades'
    
    def __str__(self):
        return f"Grades for {self.cadet.student_id}"
