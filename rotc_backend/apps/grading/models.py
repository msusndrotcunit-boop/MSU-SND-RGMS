"""
Grading models for ROTC Backend.
Includes MeritDemeritLog model for tracking merit/demerit points.
"""
from django.db import models
from apps.cadets.models import Cadet


class MeritDemeritLog(models.Model):
    """
    Merit/Demerit log entries for tracking cadet behavior and performance.
    Matches the 'merit_demerit_logs' table from Node.js backend.
    """
    TYPE_CHOICES = [
        ('merit', 'Merit'),
        ('demerit', 'Demerit'),
    ]
    
    id = models.AutoField(primary_key=True)
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, related_name='merit_demerit_logs')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    points = models.IntegerField()
    reason = models.TextField()
    issued_by_user_id = models.IntegerField()
    issued_by_name = models.CharField(max_length=255)
    date_recorded = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'merit_demerit_logs'
        indexes = [
            models.Index(fields=['cadet', 'date_recorded']),
        ]
    
    def __str__(self):
        return f"{self.type.capitalize()} - {self.points} points for {self.cadet.student_id}"
