"""
URL configuration for merit/demerit endpoints.
"""
from django.urls import path
from apps.grading import views

urlpatterns = [
    path('', views.merit_demerit_create, name='merit_demerit_create'),
    path('<int:cadet_id>', views.merit_demerit_history, name='merit_demerit_history'),
    path('delete/<int:log_id>', views.merit_demerit_delete, name='merit_demerit_delete'),
]
