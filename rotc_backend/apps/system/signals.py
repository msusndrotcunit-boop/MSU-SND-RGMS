"""
Generic signal handlers for audit logging across all tracked models.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.system.models import AuditLog, SyncEvent
from apps.cadets.models import Cadet
from apps.attendance.models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter
from apps.activities.models import Activity, ActivityImage
from apps.staff.models import TrainingStaff
from apps.messaging.models import AdminMessage, StaffMessage, Notification
from apps.authentication.models import User
import json


def get_user_id_from_context():
    """
    Get user ID from the current request context.
    This is a placeholder - in production, you'd use middleware to track the current user.
    """
    # TODO: Implement proper user tracking via middleware
    return None


def sanitize_payload(model_instance, exclude_fields=None):
    """
    Create a sanitized payload from a model instance, excluding sensitive fields.
    
    Args:
        model_instance: The Django model instance
        exclude_fields: List of field names to exclude (e.g., ['password'])
    
    Returns:
        dict: Sanitized payload
    """
    if exclude_fields is None:
        exclude_fields = ['password']
    
    payload = {}
    
    for field in model_instance._meta.fields:
        field_name = field.name
        
        # Skip excluded fields
        if field_name in exclude_fields:
            continue
        
        # Skip relation fields (they have their own IDs)
        if field.is_relation:
            # Include foreign key IDs
            if hasattr(model_instance, f'{field_name}_id'):
                payload[f'{field_name}_id'] = getattr(model_instance, f'{field_name}_id')
            continue
        
        # Get field value
        value = getattr(model_instance, field_name)
        
        # Convert non-serializable types
        if hasattr(value, 'isoformat'):  # datetime/date
            payload[field_name] = value.isoformat()
        elif isinstance(value, (str, int, float, bool, type(None))):
            payload[field_name] = value
        elif isinstance(value, dict):
            payload[field_name] = value
        else:
            payload[field_name] = str(value)
    
    return payload


# Cadet audit logging
@receiver(post_save, sender=Cadet)
def audit_cadet_save(sender, instance, created, **kwargs):
    """Create audit log when Cadet is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='cadets',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=Cadet)
def audit_cadet_delete(sender, instance, **kwargs):
    """Create audit log when Cadet is deleted."""
    AuditLog.objects.create(
        table_name='cadets',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# User audit logging
@receiver(post_save, sender=User)
def audit_user_save(sender, instance, created, **kwargs):
    """Create audit log when User is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='users',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance, exclude_fields=['password'])
    )


@receiver(post_delete, sender=User)
def audit_user_delete(sender, instance, **kwargs):
    """Create audit log when User is deleted."""
    AuditLog.objects.create(
        table_name='users',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance, exclude_fields=['password'])
    )


# TrainingDay audit logging
@receiver(post_save, sender=TrainingDay)
def audit_training_day_save(sender, instance, created, **kwargs):
    """Create audit log when TrainingDay is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='training_days',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=TrainingDay)
def audit_training_day_delete(sender, instance, **kwargs):
    """Create audit log when TrainingDay is deleted."""
    AuditLog.objects.create(
        table_name='training_days',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# AttendanceRecord audit logging
@receiver(post_save, sender=AttendanceRecord)
def audit_attendance_record_save(sender, instance, created, **kwargs):
    """Create audit log when AttendanceRecord is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='attendance_records',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=AttendanceRecord)
def audit_attendance_record_delete(sender, instance, **kwargs):
    """Create audit log when AttendanceRecord is deleted."""
    AuditLog.objects.create(
        table_name='attendance_records',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# StaffAttendanceRecord audit logging
@receiver(post_save, sender=StaffAttendanceRecord)
def audit_staff_attendance_save(sender, instance, created, **kwargs):
    """Create audit log when StaffAttendanceRecord is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='staff_attendance_records',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=StaffAttendanceRecord)
def audit_staff_attendance_delete(sender, instance, **kwargs):
    """Create audit log when StaffAttendanceRecord is deleted."""
    AuditLog.objects.create(
        table_name='staff_attendance_records',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# ExcuseLetter audit logging
@receiver(post_save, sender=ExcuseLetter)
def audit_excuse_letter_save(sender, instance, created, **kwargs):
    """Create audit log when ExcuseLetter is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='excuse_letters',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=ExcuseLetter)
def audit_excuse_letter_delete(sender, instance, **kwargs):
    """Create audit log when ExcuseLetter is deleted."""
    AuditLog.objects.create(
        table_name='excuse_letters',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# Activity audit logging
@receiver(post_save, sender=Activity)
def audit_activity_save(sender, instance, created, **kwargs):
    """Create audit log when Activity is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='activities',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=Activity)
def audit_activity_delete(sender, instance, **kwargs):
    """Create audit log when Activity is deleted."""
    AuditLog.objects.create(
        table_name='activities',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# TrainingStaff audit logging
@receiver(post_save, sender=TrainingStaff)
def audit_training_staff_save(sender, instance, created, **kwargs):
    """Create audit log when TrainingStaff is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='training_staff',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=TrainingStaff)
def audit_training_staff_delete(sender, instance, **kwargs):
    """Create audit log when TrainingStaff is deleted."""
    AuditLog.objects.create(
        table_name='training_staff',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# AdminMessage audit logging
@receiver(post_save, sender=AdminMessage)
def audit_admin_message_save(sender, instance, created, **kwargs):
    """Create audit log when AdminMessage is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='admin_messages',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=AdminMessage)
def audit_admin_message_delete(sender, instance, **kwargs):
    """Create audit log when AdminMessage is deleted."""
    AuditLog.objects.create(
        table_name='admin_messages',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


# StaffMessage audit logging
@receiver(post_save, sender=StaffMessage)
def audit_staff_message_save(sender, instance, created, **kwargs):
    """Create audit log when StaffMessage is created or updated."""
    operation = 'CREATE' if created else 'UPDATE'
    
    AuditLog.objects.create(
        table_name='staff_messages',
        operation=operation,
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )


@receiver(post_delete, sender=StaffMessage)
def audit_staff_message_delete(sender, instance, **kwargs):
    """Create audit log when StaffMessage is deleted."""
    AuditLog.objects.create(
        table_name='staff_messages',
        operation='DELETE',
        record_id=instance.id,
        user_id=get_user_id_from_context(),
        payload=sanitize_payload(instance)
    )
