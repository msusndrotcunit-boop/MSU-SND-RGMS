"""
Training Staff models for ROTC Backend.
Matches the 'training_staff' table from Node.js backend.
"""
from django.db import models


class TrainingStaff(models.Model):
    """
    Training staff model with comprehensive profile information.
    Matches the 'training_staff' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    middle_name = models.CharField(max_length=255, null=True, blank=True)
    suffix_name = models.CharField(max_length=50, null=True, blank=True)
    rank = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(unique=True)
    contact_number = models.CharField(max_length=50, null=True, blank=True)
    role = models.CharField(max_length=100, null=True, blank=True)
    profile_pic = models.TextField(null=True, blank=True)
    afpsn = models.CharField(max_length=50, null=True, blank=True)
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
    has_seen_guide = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'training_staff'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['is_archived']),
        ]
    
    def __str__(self):
        return f"{self.rank} {self.first_name} {self.last_name}"
