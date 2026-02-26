"""
Messaging and Notification models for ROTC Backend.
Includes AdminMessage, StaffMessage, Notification, and PushSubscription models.
"""
from django.db import models
from apps.authentication.models import User
from apps.staff.models import TrainingStaff


class AdminMessage(models.Model):
    """
    Admin message model for user-to-admin communication.
    Matches the 'admin_messages' table from Node.js backend.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('replied', 'Replied'),
    ]
    
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_messages')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_reply = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'admin_messages'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.subject} - {self.user.username}"


class StaffMessage(models.Model):
    """
    Staff chat message model.
    Matches the 'staff_messages' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    sender_staff = models.ForeignKey(TrainingStaff, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'staff_messages'
        ordering = ['created_at']
    
    def __str__(self):
        return f"Message from {self.sender_staff.first_name} {self.sender_staff.last_name}"



class Notification(models.Model):
    """
    Notification model for system notifications.
    Matches the 'notifications' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    type = models.CharField(max_length=50)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]
    
    def __str__(self):
        return f"Notification for {self.user.username} - {self.type}"


class PushSubscription(models.Model):
    """
    Push notification subscription model.
    Matches the 'push_subscriptions' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField()
    keys = models.JSONField()  # {p256dh, auth}
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'push_subscriptions'
    
    def __str__(self):
        return f"Push subscription for {self.user.username}"
