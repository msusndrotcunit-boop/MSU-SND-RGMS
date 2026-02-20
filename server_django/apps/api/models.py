from django.db import models

class MeritDemeritLog(models.Model):
    cadet_id = models.IntegerField()
    issued_by_user_id = models.IntegerField(null=True, blank=True)
    issued_by_name = models.CharField(max_length=255, blank=True)
    points = models.IntegerField()
    type = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

class Cadet(models.Model):
    student_id = models.CharField(max_length=64, unique=True)
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    course = models.CharField(max_length=16, blank=True)
    is_profile_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Staff(models.Model):
    username = models.CharField(max_length=64, unique=True)
    rank = models.CharField(max_length=64, blank=True)
    first_name = models.CharField(max_length=128, blank=True)
    last_name = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Attendance(models.Model):
    user_id = models.IntegerField()
    role = models.CharField(max_length=32)
    day = models.IntegerField()
    status = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('user_id', 'role', 'day')

class Grade(models.Model):
    cadet_id = models.IntegerField()
    final_percent = models.FloatField()
    transmutation = models.CharField(max_length=8)
    passed = models.BooleanField()
    status = models.CharField(max_length=16, default='Completed')  # Ongoing/Completed/Incomplete/Failed/Drop
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('cadet_id',)
