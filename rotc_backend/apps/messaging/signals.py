"""
Signal handlers for messaging app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import AdminMessage, StaffMessage, Notification
from apps.authentication.models import User


@receiver(post_save, sender=AdminMessage)
def create_notification_for_admin_message(sender, instance, created, **kwargs):
    """
    Create notification when a new admin message is created.
    Notify all admin users about the new message.
    """
    if created:
        # Get all admin users
        admin_users = User.objects.filter(role='admin', is_approved=True)
        
        # Create notification for each admin
        for admin in admin_users:
            Notification.objects.create(
                user=admin,
                message=f"New message from {instance.user.username}: {instance.subject}",
                type='admin_message'
            )


@receiver(post_save, sender=StaffMessage)
def create_notification_for_staff_message(sender, instance, created, **kwargs):
    """
    Create notification when a new staff message is created.
    Notify all training staff members about the new message.
    """
    if created:
        # Get all training staff users (excluding the sender)
        staff_users = User.objects.filter(
            role='training_staff',
            is_approved=True
        ).exclude(staff_id=instance.sender_staff.id)
        
        # Create notification for each staff member
        for staff_user in staff_users:
            Notification.objects.create(
                user=staff_user,
                message=f"New message from {instance.sender_staff.first_name} {instance.sender_staff.last_name}",
                type='staff_message'
            )
