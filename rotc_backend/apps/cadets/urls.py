"""
URL configuration for cadets app.
"""
from django.urls import path
from apps.cadets import views

urlpatterns = [
    path('', views.cadet_list_create, name='cadet_list_create'),
    path('archived', views.cadet_archived_list, name='cadet_archived_list'),
    path('<int:cadet_id>', views.cadet_detail_update_delete, name='cadet_detail_update_delete'),
    path('<int:cadet_id>/restore', views.cadet_restore, name='cadet_restore'),
]
