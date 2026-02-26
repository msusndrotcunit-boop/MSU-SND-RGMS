from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from .models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter


@admin.register(TrainingDay)
class TrainingDayAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for TrainingDay model"""
    list_display = ('id', 'date', 'title', 'location', 'created_at')
    list_filter = ('date', 'created_at')
    search_fields = ('title', 'description', 'location')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'date'
    
    fieldsets = (
        ('Training Day Information', {
            'fields': ('id', 'date', 'title', 'description', 'location')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['export_to_csv']
    
    def export_to_csv(self, request, queryset):
        """Export training days to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="training_days.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Date', 'Title', 'Description', 'Location', 'Created At'])
        
        for td in queryset:
            writer.writerow([
                td.id, td.date, td.title, td.description, td.location, td.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for AttendanceRecord model"""
    list_display = (
        'id', 'training_day', 'cadet', 'status_badge',
        'time_in', 'time_out', 'created_at'
    )
    list_filter = ('status', 'training_day__date', 'created_at')
    search_fields = (
        'cadet__student_id', 'cadet__first_name', 'cadet__last_name',
        'training_day__title'
    )
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Attendance Information', {
            'fields': ('id', 'training_day', 'cadet', 'status')
        }),
        ('Time Tracking', {
            'fields': ('time_in', 'time_out')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['mark_present', 'mark_absent', 'export_to_csv']
    
    def status_badge(self, obj):
        """Display status with color badge"""
        colors = {
            'present': '#28a745',
            'absent': '#dc3545',
            'late': '#ffc107',
            'excused': '#17a2b8'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.status.capitalize()
        )
    status_badge.short_description = 'Status'
    
    def mark_present(self, request, queryset):
        """Bulk mark as present"""
        updated = queryset.update(status='present')
        self.message_user(request, f'{updated} record(s) marked as present.')
    mark_present.short_description = 'Mark as Present'
    
    def mark_absent(self, request, queryset):
        """Bulk mark as absent"""
        updated = queryset.update(status='absent')
        self.message_user(request, f'{updated} record(s) marked as absent.')
    mark_absent.short_description = 'Mark as Absent'
    
    def export_to_csv(self, request, queryset):
        """Export attendance records to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance_records.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Training Day', 'Date', 'Cadet ID', 'Student ID',
            'Cadet Name', 'Status', 'Time In', 'Time Out'
        ])
        
        for record in queryset:
            writer.writerow([
                record.id, record.training_day.title, record.training_day.date,
                record.cadet.id, record.cadet.student_id,
                f"{record.cadet.first_name} {record.cadet.last_name}",
                record.status, record.time_in, record.time_out
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(StaffAttendanceRecord)
class StaffAttendanceRecordAdmin(admin.ModelAdmin):
    """Admin interface for StaffAttendanceRecord model"""
    list_display = ('id', 'training_day', 'staff', 'time_in', 'time_out', 'created_at')
    list_filter = ('training_day__date', 'created_at')
    search_fields = ('staff__first_name', 'staff__last_name', 'training_day__title')
    readonly_fields = ('id', 'created_at')
    
    fieldsets = (
        ('Attendance Information', {
            'fields': ('id', 'training_day', 'staff')
        }),
        ('Time Tracking', {
            'fields': ('time_in', 'time_out')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['export_to_csv']
    
    def export_to_csv(self, request, queryset):
        """Export staff attendance to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="staff_attendance.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Training Day', 'Date', 'Staff ID', 'Staff Name',
            'Time In', 'Time Out'
        ])
        
        for record in queryset:
            writer.writerow([
                record.id, record.training_day.title, record.training_day.date,
                record.staff.id, f"{record.staff.first_name} {record.staff.last_name}",
                record.time_in, record.time_out
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(ExcuseLetter)
class ExcuseLetterAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for ExcuseLetter model"""
    list_display = (
        'id', 'cadet', 'date_absent', 'status_badge',
        'reason_short', 'created_at'
    )
    list_filter = ('status', 'date_absent', 'created_at')
    search_fields = (
        'cadet__student_id', 'cadet__first_name', 'cadet__last_name', 'reason'
    )
    readonly_fields = ('id', 'created_at', 'file_preview')
    date_hierarchy = 'date_absent'
    
    fieldsets = (
        ('Excuse Letter Information', {
            'fields': ('id', 'cadet', 'training_day', 'date_absent', 'reason', 'status')
        }),
        ('Attached File', {
            'fields': ('file_url', 'file_preview')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['approve_letters', 'reject_letters', 'export_to_csv']
    
    def status_badge(self, obj):
        """Display status with color badge"""
        colors = {
            'pending': '#ffc107',
            'approved': '#28a745',
            'rejected': '#dc3545'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.status.capitalize()
        )
    status_badge.short_description = 'Status'
    
    def reason_short(self, obj):
        """Display shortened reason"""
        if len(obj.reason) > 50:
            return obj.reason[:50] + '...'
        return obj.reason
    reason_short.short_description = 'Reason'
    
    def file_preview(self, obj):
        """Display file link"""
        if obj.file_url:
            return format_html('<a href="{}" target="_blank">View File</a>', obj.file_url)
        return "No file"
    file_preview.short_description = 'File'
    
    def approve_letters(self, request, queryset):
        """Bulk approve excuse letters"""
        updated = queryset.update(status='approved')
        self.message_user(request, f'{updated} excuse letter(s) approved.')
    approve_letters.short_description = 'Approve selected letters'
    
    def reject_letters(self, request, queryset):
        """Bulk reject excuse letters"""
        updated = queryset.update(status='rejected')
        self.message_user(request, f'{updated} excuse letter(s) rejected.')
    reject_letters.short_description = 'Reject selected letters'
    
    def export_to_csv(self, request, queryset):
        """Export excuse letters to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="excuse_letters.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Cadet ID', 'Student ID', 'Cadet Name', 'Date Absent',
            'Reason', 'Status', 'File URL', 'Created At'
        ])
        
        for letter in queryset:
            writer.writerow([
                letter.id, letter.cadet.id, letter.cadet.student_id,
                f"{letter.cadet.first_name} {letter.cadet.last_name}",
                letter.date_absent, letter.reason, letter.status,
                letter.file_url, letter.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)

