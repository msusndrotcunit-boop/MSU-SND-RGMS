"""
Celery configuration for ROTC Backend.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('rotc_backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat schedule for periodic tasks
app.conf.beat_schedule = {
    'cleanup-old-notifications': {
        'task': 'apps.messaging.tasks.cleanup_old_notifications',
        'schedule': crontab(hour=2, minute=0),  # Run daily at 2 AM
    },
    'cleanup-old-audit-logs': {
        'task': 'cleanup_old_audit_logs',
        'schedule': crontab(hour=3, minute=0),  # Run daily at 3 AM
        'kwargs': {'days': 90},  # Keep audit logs for 90 days
    },
    'generate-daily-attendance-report': {
        'task': 'apps.attendance.tasks.generate_daily_attendance_report',
        'schedule': crontab(hour=18, minute=0),  # Run daily at 6 PM
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery configuration."""
    print(f'Request: {self.request!r}')


# Celery signal handlers
from celery.signals import task_failure, task_success, task_retry


@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, einfo=None, **kw):
    """
    Handle task failures and notify admins.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.error(f"Task {sender.name} ({task_id}) failed: {exception}")
    
    # Create notification for admins
    try:
        from apps.messaging.models import Notification
        from apps.authentication.models import User
        
        # Get all admin users
        admin_users = User.objects.filter(role='admin', is_approved=True)
        
        # Create notification for each admin
        for admin in admin_users:
            Notification.objects.create(
                user=admin,
                message=f"Background task failed: {sender.name}. Error: {str(exception)[:200]}",
                type='task_failure'
            )
        
        logger.info(f"Created failure notifications for {admin_users.count()} admins")
        
    except Exception as e:
        logger.error(f"Error creating failure notification: {e}")


@task_retry.connect
def task_retry_handler(sender=None, task_id=None, reason=None, einfo=None, **kw):
    """
    Log task retries.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Task {sender.name} ({task_id}) is being retried. Reason: {reason}")


@task_success.connect
def task_success_handler(sender=None, result=None, **kw):
    """
    Log successful task completion.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Task {sender.name} completed successfully")
