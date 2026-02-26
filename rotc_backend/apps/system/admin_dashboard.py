"""
Admin Dashboard with Statistics
Provides overview statistics for the ROTC system
"""
from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta


class ROTCAdminSite(admin.AdminSite):
    """Custom admin site with dashboard"""
    site_header = 'ROTC Grading System Administration'
    site_title = 'ROTC Admin'
    index_title = 'System Administration Dashboard'
    
    def get_urls(self):
        """Add custom dashboard URL"""
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_view(self.dashboard_view), name='dashboard'),
        ]
        return custom_urls + urls
    
    def dashboard_view(self, request):
        """Render dashboard with statistics"""
        from apps.authentication.models import User
        from apps.cadets.models import Cadet
        from apps.grading.models import MeritDemeritLog
        from apps.attendance.models import TrainingDay, AttendanceRecord, ExcuseLetter
        from apps.activities.models import Activity
        from apps.staff.models import TrainingStaff
        from apps.messaging.models import AdminMessage, Notification
        from apps.system.models import AuditLog, SyncEvent
        
        # Calculate statistics
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        stats = {
            # User statistics
            'total_users': User.objects.count(),
            'approved_users': User.objects.filter(is_approved=True).count(),
            'pending_users': User.objects.filter(is_approved=False).count(),
            'admin_users': User.objects.filter(role='admin').count(),
            'cadet_users': User.objects.filter(role='cadet').count(),
            'staff_users': User.objects.filter(role='training_staff').count(),
            
            # Cadet statistics
            'total_cadets': Cadet.objects.filter(is_archived=False).count(),
            'archived_cadets': Cadet.objects.filter(is_archived=True).count(),
            'completed_profiles': Cadet.objects.filter(is_profile_completed=True).count(),
            
            # Training staff statistics
            'total_staff': TrainingStaff.objects.filter(is_archived=False).count(),
            'archived_staff': TrainingStaff.objects.filter(is_archived=True).count(),
            
            # Grading statistics
            'merit_logs_week': MeritDemeritLog.objects.filter(
                type='merit',
                date_recorded__gte=week_ago
            ).count(),
            'demerit_logs_week': MeritDemeritLog.objects.filter(
                type='demerit',
                date_recorded__gte=week_ago
            ).count(),
            'total_merit_logs': MeritDemeritLog.objects.filter(type='merit').count(),
            'total_demerit_logs': MeritDemeritLog.objects.filter(type='demerit').count(),
            
            # Attendance statistics
            'training_days_month': TrainingDay.objects.filter(date__gte=month_ago).count(),
            'total_training_days': TrainingDay.objects.count(),
            'attendance_records_week': AttendanceRecord.objects.filter(
                created_at__gte=week_ago
            ).count(),
            'present_week': AttendanceRecord.objects.filter(
                status='present',
                created_at__gte=week_ago
            ).count(),
            'absent_week': AttendanceRecord.objects.filter(
                status='absent',
                created_at__gte=week_ago
            ).count(),
            
            # Excuse letter statistics
            'pending_excuse_letters': ExcuseLetter.objects.filter(status='pending').count(),
            'approved_excuse_letters': ExcuseLetter.objects.filter(status='approved').count(),
            'rejected_excuse_letters': ExcuseLetter.objects.filter(status='rejected').count(),
            
            # Activity statistics
            'total_activities': Activity.objects.count(),
            'activities_month': Activity.objects.filter(date__gte=month_ago).count(),
            'achievements': Activity.objects.filter(type='achievement').count(),
            'events': Activity.objects.filter(type='event').count(),
            
            # Messaging statistics
            'pending_messages': AdminMessage.objects.filter(status='pending').count(),
            'replied_messages': AdminMessage.objects.filter(status='replied').count(),
            'unread_notifications': Notification.objects.filter(is_read=False).count(),
            
            # System statistics
            'audit_logs_week': AuditLog.objects.filter(created_at__gte=week_ago).count(),
            'unprocessed_sync_events': SyncEvent.objects.filter(processed=False).count(),
            'sync_events_week': SyncEvent.objects.filter(created_at__gte=week_ago).count(),
        }
        
        # Recent activity
        recent_audit_logs = AuditLog.objects.order_by('-created_at')[:10]
        recent_sync_events = SyncEvent.objects.filter(processed=False).order_by('-created_at')[:10]
        pending_excuse_letters = ExcuseLetter.objects.filter(status='pending').order_by('-created_at')[:10]
        pending_messages = AdminMessage.objects.filter(status='pending').order_by('-created_at')[:10]
        
        context = {
            **self.each_context(request),
            'stats': stats,
            'recent_audit_logs': recent_audit_logs,
            'recent_sync_events': recent_sync_events,
            'pending_excuse_letters': pending_excuse_letters,
            'pending_messages': pending_messages,
            'title': 'Dashboard',
        }
        
        return render(request, 'admin/dashboard.html', context)


# Create custom admin site instance
admin_site = ROTCAdminSite(name='rotc_admin')
