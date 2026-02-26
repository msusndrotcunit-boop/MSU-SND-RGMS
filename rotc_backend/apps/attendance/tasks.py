"""
Celery tasks for attendance operations.
"""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(name='apps.attendance.tasks.generate_daily_attendance_report')
def generate_daily_attendance_report():
    """
    Generate daily attendance report.
    This task runs daily at 6 PM to summarize the day's attendance.
    
    Returns:
        dict: Report generation result
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import TrainingDay, AttendanceRecord
    from django.db.models import Count, Q
    
    try:
        logger.info("Generating daily attendance report")
        
        # Get today's training days
        today = timezone.now().date()
        training_days = TrainingDay.objects.filter(date=today)
        
        if not training_days.exists():
            logger.info("No training days scheduled for today")
            return {'status': 'skipped', 'reason': 'no_training_days'}
        
        report_data = []
        
        for training_day in training_days:
            # Get attendance statistics
            stats = AttendanceRecord.objects.filter(training_day=training_day).aggregate(
                total=Count('id'),
                present=Count('id', filter=Q(status='present')),
                absent=Count('id', filter=Q(status='absent')),
                late=Count('id', filter=Q(status='late')),
                excused=Count('id', filter=Q(status='excused'))
            )
            
            report_data.append({
                'training_day_id': training_day.id,
                'title': training_day.title,
                'date': str(training_day.date),
                'statistics': stats
            })
        
        # Create notification for admins
        from apps.messaging.models import Notification
        from apps.authentication.models import User
        
        admin_users = User.objects.filter(role='admin', is_approved=True)
        
        summary = f"Daily Attendance Report for {today}: "
        summary += f"{len(report_data)} training day(s) processed"
        
        for admin in admin_users:
            Notification.objects.create(
                user=admin,
                message=summary,
                type='daily_report'
            )
        
        logger.info(f"Daily attendance report generated: {report_data}")
        
        return {
            'status': 'success',
            'date': str(today),
            'training_days': len(report_data),
            'report': report_data
        }
        
    except Exception as e:
        logger.error(f"Error generating daily attendance report: {str(e)}")
        raise


@shared_task(bind=True, max_retries=3)
def send_attendance_reminder(self, training_day_id):
    """
    Send attendance reminder notifications to cadets.
    
    Args:
        training_day_id: ID of the training day
    
    Returns:
        dict: Reminder sending result
    """
    from .models import TrainingDay
    from apps.cadets.models import Cadet
    from apps.authentication.models import User
    from apps.messaging.models import Notification
    
    try:
        training_day = TrainingDay.objects.get(id=training_day_id)
        
        # Get all active cadets
        cadets = Cadet.objects.filter(is_archived=False)
        
        reminder_count = 0
        
        for cadet in cadets:
            # Find user associated with cadet
            user = User.objects.filter(cadet_id=cadet.id, is_approved=True).first()
            if user:
                # Create notification
                Notification.objects.create(
                    user=user,
                    message=f"Reminder: Training day '{training_day.title}' on {training_day.date}",
                    type='attendance_reminder'
                )
                reminder_count += 1
        
        logger.info(f"Sent {reminder_count} attendance reminders for training day {training_day_id}")
        
        return {
            'training_day_id': training_day_id,
            'reminders_sent': reminder_count
        }
        
    except TrainingDay.DoesNotExist:
        logger.error(f"Training day {training_day_id} not found")
        return {'status': 'failed', 'reason': 'training_day_not_found'}
    except Exception as exc:
        logger.error(f"Error sending attendance reminders: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
