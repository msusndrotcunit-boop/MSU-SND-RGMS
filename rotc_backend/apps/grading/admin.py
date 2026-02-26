from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from .models import MeritDemeritLog


@admin.register(MeritDemeritLog)
class MeritDemeritLogAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for MeritDemeritLog model"""
    list_display = (
        'id', 'cadet', 'type_badge', 'points', 'reason_short',
        'issued_by_name', 'date_recorded'
    )
    list_filter = ('type', 'date_recorded', 'cadet__company', 'cadet__platoon')
    search_fields = (
        'cadet__student_id', 'cadet__first_name', 'cadet__last_name',
        'reason', 'issued_by_name'
    )
    readonly_fields = ('id', 'date_recorded')
    date_hierarchy = 'date_recorded'
    
    fieldsets = (
        ('Log Information', {
            'fields': ('id', 'cadet', 'type', 'points', 'reason')
        }),
        ('Issued By', {
            'fields': ('issued_by_user_id', 'issued_by_name')
        }),
        ('Timestamp', {
            'fields': ('date_recorded',)
        }),
    )
    
    actions = ['export_to_csv', 'export_to_excel']
    
    def type_badge(self, obj):
        """Display type with color badge"""
        if obj.type == 'merit':
            return format_html(
                '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
                '#28a745', 'Merit'
            )
        else:
            return format_html(
                '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
                '#dc3545', 'Demerit'
            )
    type_badge.short_description = 'Type'
    
    def reason_short(self, obj):
        """Display shortened reason"""
        if len(obj.reason) > 50:
            return obj.reason[:50] + '...'
        return obj.reason
    reason_short.short_description = 'Reason'
    
    def export_to_csv(self, request, queryset):
        """Export merit/demerit logs to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="merit_demerit_logs.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Cadet ID', 'Student ID', 'Cadet Name', 'Type',
            'Points', 'Reason', 'Issued By', 'Date Recorded'
        ])
        
        for log in queryset:
            writer.writerow([
                log.id, log.cadet.id, log.cadet.student_id,
                f"{log.cadet.first_name} {log.cadet.last_name}",
                log.type, log.points, log.reason, log.issued_by_name,
                log.date_recorded
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def export_to_excel(self, request, queryset):
        """Export merit/demerit logs to Excel"""
        from openpyxl import Workbook
        from django.http import HttpResponse
        
        wb = Workbook()
        ws = wb.active
        ws.title = 'Merit Demerit Logs'
        
        # Headers
        headers = [
            'ID', 'Cadet ID', 'Student ID', 'Cadet Name', 'Type',
            'Points', 'Reason', 'Issued By', 'Date Recorded'
        ]
        ws.append(headers)
        
        # Data
        for log in queryset:
            ws.append([
                log.id, log.cadet.id, log.cadet.student_id,
                f"{log.cadet.first_name} {log.cadet.last_name}",
                log.type, log.points, log.reason, log.issued_by_name,
                str(log.date_recorded)
            ])
        
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="merit_demerit_logs.xlsx"'
        wb.save(response)
        
        return response
    export_to_excel.short_description = 'Export to Excel'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)

