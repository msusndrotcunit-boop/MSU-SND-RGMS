"""
URL configuration for authentication app.
"""
from django.urls import path
from apps.authentication import views

urlpatterns = [
    path('login', views.login_view, name='login'),
    path('register', views.register_view, name='register'),
    path('logout', views.logout_view, name='logout'),
    path('profile', views.profile_view, name='profile'),
    path('heartbeat', views.heartbeat_view, name='heartbeat'),
    path('refresh', views.token_refresh_view, name='token_refresh'),
    path('settings', views.user_settings_view, name='user-settings'),
    path('settings/reset', views.user_settings_reset_view, name='user-settings-reset'),
]
