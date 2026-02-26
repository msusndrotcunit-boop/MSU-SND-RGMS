"""
URL configuration for staff app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TrainingStaffViewSet

router = DefaultRouter()
router.register(r'staff', TrainingStaffViewSet, basename='staff')

urlpatterns = [
    path('', include(router.urls)),
]
