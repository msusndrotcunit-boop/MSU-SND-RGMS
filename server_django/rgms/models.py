from django.db import models


class Cadet(models.Model):
    student_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, default="")
    suffix_name = models.CharField(max_length=20, blank=True, default="")
    rank = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    username = models.CharField(max_length=150, blank=True, default="")
    contact_number = models.CharField(max_length=50, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    gender = models.CharField(max_length=20, blank=True, default="")
    religion = models.CharField(max_length=50, blank=True, default="")
    birthdate = models.DateField(null=True, blank=True)
    course = models.CharField(max_length=100, blank=True, default="")
    year_level = models.CharField(max_length=20, blank=True, default="")
    school_year = models.CharField(max_length=20, blank=True, default="")
    battalion = models.CharField(max_length=50, blank=True, default="")
    company = models.CharField(max_length=50, blank=True, default="")
    platoon = models.CharField(max_length=50, blank=True, default="")
    cadet_course = models.CharField(max_length=100, blank=True, default="")
    semester = models.CharField(max_length=20, blank=True, default="")
    corp_position = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, blank=True, default="Ongoing")
    is_profile_completed = models.BooleanField(default=False)
    profile_pic = models.CharField(max_length=255, blank=True, default="")
    attendance_present = models.IntegerField(default=0)
    attendance_total = models.IntegerField(default=15)
    merit_points = models.IntegerField(default=0)
    demerit_points = models.IntegerField(default=0)
    prelim_score = models.FloatField(default=0)
    midterm_score = models.FloatField(default=0)
    final_score = models.FloatField(default=0)
    subject_score = models.FloatField(default=0)
    attendance_score = models.FloatField(default=0)
    aptitude_score = models.FloatField(default=0)
    final_grade = models.FloatField(default=0)
    transmuted_grade = models.CharField(max_length=4, default="5.00")
    grade_remarks = models.CharField(max_length=32, blank=True, default="")
    grade_status = models.CharField(max_length=16, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class MeritDemeritLog(models.Model):
    TYPE_CHOICES = [
        ("merit", "Merit"),
        ("demerit", "Demerit"),
    ]

    cadet = models.ForeignKey(
        Cadet, related_name="merit_logs", on_delete=models.CASCADE
    )
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    points = models.IntegerField()
    reason = models.TextField(blank=True, default="")
    issued_by_name = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

