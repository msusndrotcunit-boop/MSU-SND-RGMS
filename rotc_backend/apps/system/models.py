"""
System models for ROTC Backend.
Includes SystemSettings, AuditLog, and SyncEvent models.
"""
from django.db import models


class SystemSettings(models.Model):
    """
    System-wide settings model with key-value pairs.
    Matches the 'system_settings' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    key = models.CharField(max_length=255, unique=True)
    value = models.TextField()
    
    class Meta:
        db_table = 'system_settings'
    
    def __str__(self):
        return f"{self.key}: {self.value[:50]}"


class AuditLog(models.Model):
    """
    Audit log model for tracking data modifications.
    Matches the 'audit_logs' table from Node.js backend.
    """
    OPERATION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]
    
    id = models.AutoField(primary_key=True)
    table_name = models.CharField(max_length=255)
    operation = models.CharField(max_length=10, choices=OPERATION_CHOICES)
    record_id = models.IntegerField()
    user_id = models.IntegerField(null=True, blank=True)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['table_name', 'operation']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.operation} on {self.table_name} (ID: {self.record_id})"



class SyncEvent(models.Model):
    """
    Sync event model for real-time updates.
    Matches the 'sync_events' table from Node.js backend.
    """
    id = models.AutoField(primary_key=True)
    event_type = models.CharField(max_length=50)
    cadet_id = models.IntegerField(null=True, blank=True)
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sync_events'
        indexes = [
            models.Index(fields=['processed', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {'Processed' if self.processed else 'Pending'}"
