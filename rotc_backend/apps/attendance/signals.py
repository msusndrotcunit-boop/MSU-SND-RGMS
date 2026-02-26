"""
Signal handlers for attendance app.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import AttendanceRecord, ExcuseLetter
from apps.cadets.models import Grades
from apps.system.models import SyncEvent
from apps.messaging.websocket_utils import broadcast_attendance_update


@receiver(pre_save, sender=AttendanceRecord)
def track_attendance_status_change(sender, instance, **kwargs):
    """Track previous status before update to handle grade changes."""
    if instance.pk:
        try:
            instance._previous_status = AttendanceRecord.objects.get(pk=instance.pk).status
        except AttendanceRecord.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=AttendanceRecord)
def update_attendance_grade(sender, instance, created, **kwargs):
    """
    Update cadet's attendance_present count when attendance status changes.
    Increment when status='present', decrement when changing from 'present' to other status.
    """
    try:
        grades = Grades.objects.get(cadet=instance.cadet)
    except Grades.DoesNotExist:
        # If grades don't exist, create them
        grades = Grades.objects.create(cadet=instance.cadet)
    
    previous_status = getattr(instance, '_previous_status', None)
    current_status = instance.status
    
    attendance_changed = False
    
    if created:
        # New attendance record
        if current_status == 'present':
            grades.attendance_present += 1
            grades.save()
            attendance_changed = True
    else:
        # Updated attendance record
        if previous_status != current_status:
            # Status changed
            if previous_status == 'present' and current_status != 'present':
                # Changed from present to something else - decrement
                if grades.attendance_present > 0:
                    grades.attendance_present -= 1
                    grades.save()
                    attendance_changed = True
            elif previous_status != 'present' and current_status == 'present':
                # Changed from non-present to present - increment
                grades.attendance_present += 1
                grades.save()
                attendance_changed = True
    
    # Broadcast attendance update via WebSocket if attendance count changed
    if attendance_changed:
        attendance_data = {
            'training_day_id': instance.training_day.id,
            'status': current_status,
            'attendance_present': grades.attendance_present,
            'time_in': instance.time_in.isoformat() if instance.time_in else None,
            'time_out': instance.time_out.isoformat() if instance.time_out else None,
        }
        broadcast_attendance_update(instance.cadet.id, attendance_data)
        
        # Create sync event for real-time updates
        SyncEvent.objects.create(
            event_type='attendance_update',
            cadet_id=instance.cadet.id,
            payload=attendance_data
        )


@receiver(post_save, sender=ExcuseLetter)
def update_attendance_on_excuse_approval(sender, instance, created, **kwargs):
    """
    When an excuse letter is approved, update the linked attendance record to 'excused'.
    """
    if not created and instance.status == 'approved' and instance.training_day:
        # Find the attendance record for this cadet and training day
        try:
            attendance_record = AttendanceRecord.objects.get(
                cadet=instance.cadet,
                training_day=instance.training_day
            )
            # Update status to excused
            if attendance_record.status != 'excused':
                attendance_record.status = 'excused'
                attendance_record.save()
        except AttendanceRecord.DoesNotExist:
            # No attendance record exists, optionally create one
            AttendanceRecord.objects.create(
                cadet=instance.cadet,
                training_day=instance.training_day,
                status='excused'
            )
