"""
URL configuration for messaging app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminMessageViewSet, StaffMessageViewSet,
    NotificationViewSet, PushSubscriptionViewSet
)

router = DefaultRouter()
router.register(r'messages/admin', AdminMessageViewSet, basename='admin-message')
router.register(r'messages/staff', StaffMessageViewSet, basename='staff-message')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'push/subscriptions', PushSubscriptionViewSet, basename='push-subscription')

urlpatterns = [
    path('', include(router.urls)),
]
