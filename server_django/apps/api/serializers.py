from rest_framework import serializers
from .models import Cadet, Staff, Attendance, Grade, MeritDemeritLog

class CadetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cadet
        fields = '__all__'

class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = '__all__'

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'

class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = '__all__'

class MeritDemeritLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeritDemeritLog
        fields = '__all__'
