"""
Activities models for ROTC Backend.
Includes Activity and ActivityImage models.
"""
from django.db import models


class Activity(models.Model):
    """
    Activity/Achievement/Event model.
    Matches the 'activities' table from Node.js backend.
    """
    TYPE_CHOICES = [
        ('activity', 'Activity'),
        ('achievement', 'Achievement'),
        ('event', 'Event'),
    ]
    
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    date = models.DateField()
    image_path = models.TextField(null=True, blank=True)
    images = models.TextField(null=True, blank=True)  # JSON array of URLs
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='activity')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'activities'
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.title} ({self.type})"


class ActivityImage(models.Model):
    """
    Activity image model for multiple images per activity.
    Matches the 'activity_images' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='activity_images')
    image_url = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'activity_images'
    
    def __str__(self):
        return f"Image for {self.activity.title}"
