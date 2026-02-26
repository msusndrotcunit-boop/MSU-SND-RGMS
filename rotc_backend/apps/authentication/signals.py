"""
Signal handlers for authentication app.
Automatically creates UserSettings when a User is created.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.authentication.models import User, UserSettings


@receiver(post_save, sender=User)
def create_user_settings(sender, instance, created, **kwargs):
    """
    Create default UserSettings when a new User is created.
    """
    if created:
        UserSettings.objects.create(
            user=instance,
            email_alerts=True,
            push_notifications=True,
            activity_updates=True,
            dark_mode=False,
            compact_mode=False,
            primary_color='blue',
        )
