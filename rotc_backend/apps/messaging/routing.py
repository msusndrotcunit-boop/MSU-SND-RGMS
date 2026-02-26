"""
WebSocket URL routing for real-time updates.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/updates/$', consumers.UpdatesConsumer.as_asgi()),
]
