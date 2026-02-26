"""
URL configuration for activities app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivityViewSet, ActivityImageViewSet

router = DefaultRouter()
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'activity-images', ActivityImageViewSet, basename='activity-image')

urlpatterns = [
    path('', include(router.urls)),
]
