"""
URL configuration for attendance app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TrainingDayViewSet, AttendanceRecordViewSet,
    StaffAttendanceRecordViewSet, ExcuseLetterViewSet
)

router = DefaultRouter()
router.register(r'training-days', TrainingDayViewSet, basename='training-day')
router.register(r'attendance', AttendanceRecordViewSet, basename='attendance')
router.register(r'staff-attendance', StaffAttendanceRecordViewSet, basename='staff-attendance')
router.register(r'excuse-letters', ExcuseLetterViewSet, basename='excuse-letter')

urlpatterns = [
    path('', include(router.urls)),
]
