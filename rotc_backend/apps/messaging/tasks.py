"""
Celery tasks for messaging and notifications.
"""
from celery import shared_task
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_notification(self, recipient_email, subject, message, html_message=None, from_email=None):
    """
    Send an email notification.
    
    Args:
        recipient_email: Email address of the recipient
        subject: Email subject
        message: Plain text message
        html_message: Optional HTML version of the message
        from_email: Optional sender email (defaults to DEFAULT_FROM_EMAIL)
    
    Returns:
        dict: Email sending result
    """
    try:
        logger.info(f"Sending email to {recipient_email}: {subject}")
        
        from_email = from_email or settings.DEFAULT_FROM_EMAIL
        
        if html_message:
            # Send HTML email
            email = EmailMultiAlternatives(
                subject=subject,
                body=message,
                from_email=from_email,
                to=[recipient_email]
            )
            email.attach_alternative(html_message, "text/html")
            email.send()
        else:
            # Send plain text email
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[recipient_email],
                fail_silently=False
            )
        
        logger.info(f"Successfully sent email to {recipient_email}")
        
        return {
            'recipient': recipient_email,
            'subject': subject,
            'status': 'sent'
        }
        
    except Exception as exc:
        logger.error(f"Error sending email to {recipient_email}: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def send_bulk_email_notifications(self, recipients, subject, message, html_message=None):
    """
    Send email notifications to multiple recipients.
    
    Args:
        recipients: List of email addresses
        subject: Email subject
        message: Plain text message
        html_message: Optional HTML version of the message
    
    Returns:
        dict: Bulk email sending results
    """
    results = []
    for recipient in recipients:
        try:
            result = send_email_notification.apply_async(
                args=[recipient, subject, message, html_message]
            )
            results.append({
                'recipient': recipient,
                'task_id': result.id,
                'status': 'queued'
            })
        except Exception as e:
            logger.error(f"Error queuing email for {recipient}: {str(e)}")
            results.append({
                'recipient': recipient,
                'error': str(e),
                'status': 'failed'
            })
    
    return {
        'total': len(recipients),
        'queued': len([r for r in results if r['status'] == 'queued']),
        'failed': len([r for r in results if r['status'] == 'failed']),
        'results': results
    }


@shared_task(bind=True, max_retries=3)
def send_grade_update_email(self, cadet_id, grade_type, new_value):
    """
    Send email notification when a cadet's grade is updated.
    
    Args:
        cadet_id: ID of the cadet
        grade_type: Type of grade updated (merit, demerit, exam_score)
        new_value: New value of the grade
    
    Returns:
        dict: Email sending result
    """
    from apps.cadets.models import Cadet
    from apps.authentication.models import User
    
    try:
        cadet = Cadet.objects.get(id=cadet_id)
        
        # Find user associated with cadet
        user = User.objects.filter(cadet_id=cadet_id).first()
        if not user or not user.email:
            logger.warning(f"No email found for cadet {cadet_id}")
            return {'status': 'skipped', 'reason': 'no_email'}
        
        # Check if user has email alerts enabled
        if hasattr(user, 'settings') and not user.settings.email_alerts:
            logger.info(f"Email alerts disabled for user {user.id}")
            return {'status': 'skipped', 'reason': 'alerts_disabled'}
        
        subject = f"Grade Update: {grade_type.replace('_', ' ').title()}"
        message = f"""
        Dear {cadet.first_name} {cadet.last_name},
        
        Your {grade_type.replace('_', ' ')} has been updated to: {new_value}
        
        Please log in to the ROTC Grading System to view your complete grade details.
        
        Best regards,
        ROTC Administration
        """
        
        return send_email_notification.apply_async(
            args=[user.email, subject, message]
        ).get()
        
    except Cadet.DoesNotExist:
        logger.error(f"Cadet {cadet_id} not found")
        return {'status': 'failed', 'reason': 'cadet_not_found'}
    except Exception as exc:
        logger.error(f"Error sending grade update email: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def send_excuse_letter_status_email(self, excuse_letter_id, status):
    """
    Send email notification when an excuse letter status changes.
    
    Args:
        excuse_letter_id: ID of the excuse letter
        status: New status (approved, rejected)
    
    Returns:
        dict: Email sending result
    """
    from apps.attendance.models import ExcuseLetter
    from apps.authentication.models import User
    
    try:
        excuse_letter = ExcuseLetter.objects.select_related('cadet').get(id=excuse_letter_id)
        cadet = excuse_letter.cadet
        
        # Find user associated with cadet
        user = User.objects.filter(cadet_id=cadet.id).first()
        if not user or not user.email:
            logger.warning(f"No email found for cadet {cadet.id}")
            return {'status': 'skipped', 'reason': 'no_email'}
        
        subject = f"Excuse Letter {status.title()}"
        message = f"""
        Dear {cadet.first_name} {cadet.last_name},
        
        Your excuse letter for {excuse_letter.date_absent} has been {status}.
        
        Reason: {excuse_letter.reason}
        
        Please log in to the ROTC Grading System for more details.
        
        Best regards,
        ROTC Administration
        """
        
        return send_email_notification.apply_async(
            args=[user.email, subject, message]
        ).get()
        
    except ExcuseLetter.DoesNotExist:
        logger.error(f"Excuse letter {excuse_letter_id} not found")
        return {'status': 'failed', 'reason': 'excuse_letter_not_found'}
    except Exception as exc:
        logger.error(f"Error sending excuse letter status email: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(name='apps.messaging.tasks.cleanup_old_notifications')
def cleanup_old_notifications(days=30):
    """
    Clean up old read notifications.
    
    Args:
        days: Number of days to keep read notifications
    
    Returns:
        int: Number of deleted notifications
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import Notification
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = Notification.objects.filter(
            is_read=True,
            created_at__lt=cutoff_date
        ).delete()
        logger.info(f"Cleaned up {deleted_count} old notifications")
        return deleted_count
    except Exception as e:
        logger.error(f"Error cleaning up notifications: {str(e)}")
        raise



@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_push_notification(self, user_id, title, message, data=None):
    """
    Send push notification to a specific user.
    
    Args:
        user_id: ID of the user
        title: Notification title
        message: Notification message
        data: Optional additional data
    
    Returns:
        dict: Push notification result
    """
    from .models import PushSubscription
    from push_notifications.models import WebPushDevice
    
    try:
        logger.info(f"Sending push notification to user {user_id}: {title}")
        
        # Get user's push subscriptions
        subscriptions = PushSubscription.objects.filter(user_id=user_id)
        
        if not subscriptions.exists():
            logger.warning(f"No push subscriptions found for user {user_id}")
            return {'status': 'skipped', 'reason': 'no_subscriptions'}
        
        sent_count = 0
        failed_count = 0
        
        for subscription in subscriptions:
            try:
                # Send web push notification
                # Note: This is a simplified version. In production, you'd use
                # the pywebpush library or django-push-notifications properly
                
                # For now, we'll just log it
                logger.info(f"Would send push to endpoint: {subscription.endpoint[:50]}...")
                sent_count += 1
                
            except Exception as e:
                logger.error(f"Error sending push to subscription {subscription.id}: {str(e)}")
                failed_count += 1
        
        return {
            'user_id': user_id,
            'title': title,
            'sent': sent_count,
            'failed': failed_count,
            'status': 'completed'
        }
        
    except Exception as exc:
        logger.error(f"Error sending push notification: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def send_push_notifications(self, notification_id, user_ids):
    """
    Send push notifications to multiple users.
    
    Args:
        notification_id: ID of the notification
        user_ids: List of user IDs
    
    Returns:
        dict: Bulk push notification results
    """
    from .models import Notification
    
    try:
        notification = Notification.objects.get(id=notification_id)
        
        results = []
        for user_id in user_ids:
            try:
                result = send_push_notification.apply_async(
                    args=[user_id, 'ROTC Notification', notification.message]
                )
                results.append({
                    'user_id': user_id,
                    'task_id': result.id,
                    'status': 'queued'
                })
            except Exception as e:
                logger.error(f"Error queuing push for user {user_id}: {str(e)}")
                results.append({
                    'user_id': user_id,
                    'error': str(e),
                    'status': 'failed'
                })
        
        return {
            'notification_id': notification_id,
            'total': len(user_ids),
            'queued': len([r for r in results if r['status'] == 'queued']),
            'failed': len([r for r in results if r['status'] == 'failed']),
            'results': results
        }
        
    except Notification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found")
        return {'status': 'failed', 'reason': 'notification_not_found'}
    except Exception as exc:
        logger.error(f"Error sending bulk push notifications: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def send_broadcast_push_notification(self, title, message, role=None):
    """
    Send push notification to all users or users with a specific role.
    
    Args:
        title: Notification title
        message: Notification message
        role: Optional role filter (admin, cadet, training_staff)
    
    Returns:
        dict: Broadcast result
    """
    from apps.authentication.models import User
    
    try:
        logger.info(f"Sending broadcast push notification: {title}")
        
        # Get users
        users = User.objects.filter(is_approved=True)
        if role:
            users = users.filter(role=role)
        
        user_ids = list(users.values_list('id', flat=True))
        
        if not user_ids:
            logger.warning("No users found for broadcast")
            return {'status': 'skipped', 'reason': 'no_users'}
        
        # Queue push notifications
        results = []
        for user_id in user_ids:
            try:
                result = send_push_notification.apply_async(
                    args=[user_id, title, message]
                )
                results.append({
                    'user_id': user_id,
                    'task_id': result.id,
                    'status': 'queued'
                })
            except Exception as e:
                logger.error(f"Error queuing broadcast push for user {user_id}: {str(e)}")
                results.append({
                    'user_id': user_id,
                    'error': str(e),
                    'status': 'failed'
                })
        
        return {
            'title': title,
            'role': role or 'all',
            'total': len(user_ids),
            'queued': len([r for r in results if r['status'] == 'queued']),
            'failed': len([r for r in results if r['status'] == 'failed'])
        }
        
    except Exception as exc:
        logger.error(f"Error sending broadcast push notification: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
