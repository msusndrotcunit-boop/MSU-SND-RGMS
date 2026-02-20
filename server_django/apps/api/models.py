from django.db import models

class MeritDemeritLog(models.Model):
    cadet_id = models.IntegerField()
    issued_by_user_id = models.IntegerField(null=True, blank=True)
    issued_by_name = models.CharField(max_length=255, blank=True)
    points = models.IntegerField()
    type = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

