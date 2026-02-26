"""
Django signals for automatic grade updates and audit logging.
"""
from django.db.models.signals import post_save, post_delete, pre_delete, pre_save
from django.dispatch import receiver
from django.db import transaction
from apps.grading.models import MeritDemeritLog
from apps.cadets.models import Grades
from apps.system.models import AuditLog, SyncEvent
from core.cache import invalidate_grades_cache
from apps.messaging.websocket_utils import broadcast_grade_update, broadcast_exam_score_update
import json


@receiver(pre_save, sender=Grades)
def track_exam_score_changes(sender, instance, **kwargs):
    """Track previous exam scores before update to detect changes."""
    if instance.pk:
        try:
            previous = Grades.objects.get(pk=instance.pk)
            instance._previous_prelim = previous.prelim_score
            instance._previous_midterm = previous.midterm_score
            instance._previous_final = previous.final_score
        except Grades.DoesNotExist:
            instance._previous_prelim = None
            instance._previous_midterm = None
            instance._previous_final = None
    else:
        instance._previous_prelim = None
        instance._previous_midterm = None
        instance._previous_final = None


@receiver(post_save, sender=Grades)
def broadcast_exam_score_changes(sender, instance, created, **kwargs):
    """
    Broadcast exam score updates via WebSocket when scores change.
    """
    if not created:
        # Check if any exam scores changed
        previous_prelim = getattr(instance, '_previous_prelim', None)
        previous_midterm = getattr(instance, '_previous_midterm', None)
        previous_final = getattr(instance, '_previous_final', None)
        
        score_changed = False
        changed_scores = {}
        
        if previous_prelim != instance.prelim_score:
            score_changed = True
            changed_scores['prelim_score'] = instance.prelim_score
        
        if previous_midterm != instance.midterm_score:
            score_changed = True
            changed_scores['midterm_score'] = instance.midterm_score
        
        if previous_final != instance.final_score:
            score_changed = True
            changed_scores['final_score'] = instance.final_score
        
        # Broadcast if any score changed
        if score_changed:
            exam_data = {
                'prelim_score': instance.prelim_score,
                'midterm_score': instance.midterm_score,
                'final_score': instance.final_score,
                'changed_scores': changed_scores,
            }
            broadcast_exam_score_update(instance.cadet.id, exam_data)
            
            # Create sync event for real-time updates
            SyncEvent.objects.create(
                event_type='exam_score_update',
                cadet_id=instance.cadet.id,
                payload=exam_data
            )


@receiver(post_save, sender=MeritDemeritLog)
def update_grades_on_merit_demerit_save(sender, instance, created, **kwargs):
    """
    Automatically update Grades when a MeritDemeritLog is created or updated.
    """
    if created:
        # Get the cadet's grades
        try:
            grades = Grades.objects.get(cadet=instance.cadet)
            
            # Update merit or demerit points
            if instance.type == 'merit':
                grades.merit_points += instance.points
            elif instance.type == 'demerit':
                grades.demerit_points += instance.points
            
            grades.save()
            
            # Invalidate grades cache
            invalidate_grades_cache(instance.cadet.id)
            
            # Prepare grade data for broadcasting
            grade_data = {
                'type': instance.type,
                'points': instance.points,
                'merit_points': grades.merit_points,
                'demerit_points': grades.demerit_points,
                'reason': instance.reason,
                'attendance_present': grades.attendance_present,
                'prelim_score': grades.prelim_score,
                'midterm_score': grades.midterm_score,
                'final_score': grades.final_score,
            }
            
            # Broadcast grade update via WebSocket
            broadcast_grade_update(instance.cadet.id, grade_data)
            
            # Create sync event for real-time updates
            SyncEvent.objects.create(
                event_type='grade_update',
                cadet_id=instance.cadet.id,
                payload=grade_data
            )
            
        except Grades.DoesNotExist:
            pass


@receiver(post_delete, sender=MeritDemeritLog)
def update_grades_on_merit_demerit_delete(sender, instance, **kwargs):
    """
    Automatically update Grades when a MeritDemeritLog is deleted.
    """
    try:
        grades = Grades.objects.get(cadet=instance.cadet)
        
        # Reverse the merit or demerit points
        if instance.type == 'merit':
            grades.merit_points = max(0, grades.merit_points - instance.points)
        elif instance.type == 'demerit':
            grades.demerit_points = max(0, grades.demerit_points - instance.points)
        
        grades.save()
        
        # Invalidate grades cache
        invalidate_grades_cache(instance.cadet.id)
        
        # Prepare grade data for broadcasting
        grade_data = {
            'type': f'{instance.type}_deleted',
            'points': instance.points,
            'merit_points': grades.merit_points,
            'demerit_points': grades.demerit_points,
            'attendance_present': grades.attendance_present,
            'prelim_score': grades.prelim_score,
            'midterm_score': grades.midterm_score,
            'final_score': grades.final_score,
        }
        
        # Broadcast grade update via WebSocket
        broadcast_grade_update(instance.cadet.id, grade_data)
        
        # Create sync event for real-time updates
        SyncEvent.objects.create(
            event_type='grade_update',
            cadet_id=instance.cadet.id,
            payload=grade_data
        )
        
    except Grades.DoesNotExist:
        pass


@receiver(post_save, sender=Grades)
def create_audit_log_on_grades_save(sender, instance, created, **kwargs):
    """
    Create audit log entry when Grades are created or updated.
    """
    operation = 'CREATE' if created else 'UPDATE'
    
    # Get the user from the current request context if available
    # For now, we'll use a placeholder
    user_id = None
    
    AuditLog.objects.create(
        table_name='grades',
        operation=operation,
        record_id=instance.id,
        user_id=user_id,
        payload={
            'cadet_id': instance.cadet.id,
            'attendance_present': instance.attendance_present,
            'merit_points': instance.merit_points,
            'demerit_points': instance.demerit_points,
            'prelim_score': instance.prelim_score,
            'midterm_score': instance.midterm_score,
            'final_score': instance.final_score,
        }
    )


@receiver(post_save, sender=MeritDemeritLog)
def create_audit_log_on_merit_demerit_save(sender, instance, created, **kwargs):
    """
    Create audit log entry when MeritDemeritLog is created.
    """
    if created:
        AuditLog.objects.create(
            table_name='merit_demerit_logs',
            operation='CREATE',
            record_id=instance.id,
            user_id=instance.issued_by_user_id,
            payload={
                'cadet_id': instance.cadet.id,
                'type': instance.type,
                'points': instance.points,
                'reason': instance.reason,
                'issued_by_name': instance.issued_by_name,
            }
        )
