"""
URL configuration for grading app.
"""
from django.urls import path
from apps.grading import views

urlpatterns = [
    path('', views.grades_list, name='grades_list'),
    path('<int:cadet_id>', views.grades_detail_or_update, name='grades_detail_or_update'),
]
