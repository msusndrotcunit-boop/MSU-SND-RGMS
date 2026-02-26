"""
Authentication models for ROTC Backend.
Includes User and UserSettings models matching the Node.js schema exactly.
"""
from django.db import models


class User(models.Model):
    """
    User model with role-based access control.
    Matches the 'users' table from Node.js backend.
    """
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('cadet', 'Cadet'),
        ('training_staff', 'Training Staff'),
    ]
    
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)  # bcrypt hash
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_approved = models.BooleanField(default=False)
    cadet_id = models.IntegerField(null=True, blank=True)
    staff_id = models.IntegerField(null=True, blank=True)
    profile_pic = models.TextField(null=True, blank=True)  # Cloudinary URL
    last_latitude = models.FloatField(null=True, blank=True)
    last_longitude = models.FloatField(null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class UserSettings(models.Model):
    """
    User preferences and customization settings.
    Matches the 'user_settings' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    email_alerts = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)
    activity_updates = models.BooleanField(default=True)
    dark_mode = models.BooleanField(default=False)
    compact_mode = models.BooleanField(default=False)
    primary_color = models.CharField(max_length=50, default='blue')
    custom_bg = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_settings'
    
    def __str__(self):
        return f"Settings for {self.user.username}"
