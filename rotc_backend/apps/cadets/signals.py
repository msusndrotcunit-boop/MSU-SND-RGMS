"""
Django signals for Cadet model.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.cadets.models import Cadet, Grades


@receiver(post_save, sender=Cadet)
def create_grades_for_cadet(sender, instance, created, **kwargs):
    """
    Automatically create Grades record when a Cadet is created.
    """
    if created:
        Grades.objects.get_or_create(cadet=instance)
