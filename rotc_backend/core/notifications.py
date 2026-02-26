"""
Utility functions for sending critical error notifications to admins.
"""
import logging
from django.core.mail import mail_admins
from django.conf import settings
from apps.messaging.models import Notification
from apps.authentication.models import User


logger = logging.getLogger(__name__)


def send_critical_error_notification(error_type, error_message, error_details=None):
    """
    Send critical error notification to all admin users.
    
    Args:
        error_type: Type of error (e.g., 'Database Error', 'Redis Error')
        error_message: Brief error message
        error_details: Optional detailed error information
    """
    try:
        # Get all admin users
        admin_users = User.objects.filter(role='admin', is_approved=True)
        
        # Create notification for each admin
        for admin in admin_users:
            try:
                Notification.objects.create(
                    user=admin,
                    message=f'Critical Error: {error_type} - {error_message}',
                    type='critical_error',
                    is_read=False
                )
            except Exception as e:
                logger.error(f'Failed to create notification for admin {admin.username}: {e}')
        
        # Also send email to admins if configured
        if hasattr(settings, 'ADMINS') and settings.ADMINS:
            try:
                subject = f'[ROTC System] Critical Error: {error_type}'
                message = f"""
A critical error has occurred in the ROTC system:

Error Type: {error_type}
Error Message: {error_message}

{f'Details: {error_details}' if error_details else ''}

Please investigate immediately.

Environment: {settings.DEBUG and 'Development' or 'Production'}
                """
                mail_admins(subject, message, fail_silently=True)
            except Exception as e:
                logger.error(f'Failed to send email to admins: {e}')
        
        logger.info(f'Critical error notification sent: {error_type} - {error_message}')
        
    except Exception as e:
        logger.error(f'Failed to send critical error notification: {e}', exc_info=True)


def send_performance_alert(alert_type, alert_message, metrics=None):
    """
    Send performance alert notification to admins.
    
    Args:
        alert_type: Type of alert (e.g., 'High Error Rate', 'Slow Response Time')
        alert_message: Brief alert message
        metrics: Optional metrics data
    """
    try:
        # Get all admin users
        admin_users = User.objects.filter(role='admin', is_approved=True)
        
        # Create notification for each admin
        for admin in admin_users:
            try:
                Notification.objects.create(
                    user=admin,
                    message=f'Performance Alert: {alert_type} - {alert_message}',
                    type='performance_alert',
                    is_read=False
                )
            except Exception as e:
                logger.error(f'Failed to create performance alert for admin {admin.username}: {e}')
        
        logger.info(f'Performance alert sent: {alert_type} - {alert_message}')
        
    except Exception as e:
        logger.error(f'Failed to send performance alert: {e}', exc_info=True)


def send_security_alert(alert_type, alert_message, details=None):
    """
    Send security alert notification to admins.
    
    Args:
        alert_type: Type of alert (e.g., 'Multiple Failed Logins', 'Suspicious Activity')
        alert_message: Brief alert message
        details: Optional detailed information
    """
    try:
        # Get all admin users
        admin_users = User.objects.filter(role='admin', is_approved=True)
        
        # Create notification for each admin
        for admin in admin_users:
            try:
                Notification.objects.create(
                    user=admin,
                    message=f'Security Alert: {alert_type} - {alert_message}',
                    type='security_alert',
                    is_read=False
                )
            except Exception as e:
                logger.error(f'Failed to create security alert for admin {admin.username}: {e}')
        
        # Also send email for security alerts
        if hasattr(settings, 'ADMINS') and settings.ADMINS:
            try:
                subject = f'[ROTC System] Security Alert: {alert_type}'
                message = f"""
A security alert has been triggered in the ROTC system:

Alert Type: {alert_type}
Alert Message: {alert_message}

{f'Details: {details}' if details else ''}

Please investigate immediately.

Environment: {settings.DEBUG and 'Development' or 'Production'}
                """
                mail_admins(subject, message, fail_silently=True)
            except Exception as e:
                logger.error(f'Failed to send security alert email: {e}')
        
        logger.warning(f'Security alert sent: {alert_type} - {alert_message}')
        
    except Exception as e:
        logger.error(f'Failed to send security alert: {e}', exc_info=True)
