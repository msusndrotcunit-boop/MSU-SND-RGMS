from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from django.utils.safestring import mark_safe
import json
from .models import SystemSettings, AuditLog, SyncEvent


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for SystemSettings model"""
    list_display = ('id', 'key', 'value_short', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('key', 'value')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Setting Information', {
            'fields': ('id', 'key', 'value')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    actions = ['export_to_csv']
    
    def value_short(self, obj):
        """Display shortened value"""
        if len(obj.value) > 50:
            return obj.value[:50] + '...'
        return obj.value
    value_short.short_description = 'Value'
    
    def export_to_csv(self, request, queryset):
        """Export system settings to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="system_settings.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Key', 'Value', 'Created At', 'Updated At'])
        
        for setting in queryset:
            writer.writerow([
                setting.id, setting.key, setting.value,
                setting.created_at, setting.updated_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for AuditLog model"""
    list_display = (
        'id', 'table_name', 'operation_badge', 'record_id',
        'user_id', 'created_at'
    )
    list_filter = ('table_name', 'operation', 'created_at')
    search_fields = ('table_name', 'record_id', 'user_id')
    readonly_fields = ('id', 'created_at', 'payload_formatted')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Audit Information', {
            'fields': ('id', 'table_name', 'operation', 'record_id', 'user_id')
        }),
        ('Payload', {
            'fields': ('payload_formatted',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['export_to_csv']
    
    def operation_badge(self, obj):
        """Display operation with color badge"""
        colors = {
            'CREATE': '#28a745',
            'UPDATE': '#ffc107',
            'DELETE': '#dc3545'
        }
        color = colors.get(obj.operation, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.operation
        )
    operation_badge.short_description = 'Operation'
    
    def payload_formatted(self, obj):
        """Display formatted JSON payload"""
        if obj.payload:
            try:
                formatted = json.dumps(obj.payload, indent=2)
                return mark_safe(f'<pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">{formatted}</pre>')
            except:
                return str(obj.payload)
        return "No payload"
    payload_formatted.short_description = 'Payload'
    
    def export_to_csv(self, request, queryset):
        """Export audit logs to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Table Name', 'Operation', 'Record ID',
            'User ID', 'Payload', 'Created At'
        ])
        
        for log in queryset:
            writer.writerow([
                log.id, log.table_name, log.operation, log.record_id,
                log.user_id, json.dumps(log.payload) if log.payload else '',
                log.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)
    
    def has_add_permission(self, request):
        """Prevent manual creation of audit logs"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Prevent editing of audit logs"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Allow deletion only for superusers"""
        return is_admin_user(request.user)


@admin.register(SyncEvent)
class SyncEventAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for SyncEvent model"""
    list_display = (
        'id', 'event_type', 'cadet_id', 'processed_badge', 'created_at'
    )
    list_filter = ('event_type', 'processed', 'created_at')
    search_fields = ('event_type', 'cadet_id')
    readonly_fields = ('id', 'created_at', 'payload_formatted')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Sync Event Information', {
            'fields': ('id', 'event_type', 'cadet_id', 'processed')
        }),
        ('Payload', {
            'fields': ('payload_formatted',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['mark_processed', 'mark_unprocessed', 'export_to_csv']
    
    def processed_badge(self, obj):
        """Display processed status with badge"""
        if obj.processed:
            return format_html(
                '<span style="background-color: #28a745; color: white; padding: 3px 8px; border-radius: 3px;">Processed</span>'
            )
        else:
            return format_html(
                '<span style="background-color: #ffc107; color: white; padding: 3px 8px; border-radius: 3px;">Pending</span>'
            )
    processed_badge.short_description = 'Status'
    
    def payload_formatted(self, obj):
        """Display formatted JSON payload"""
        if obj.payload:
            try:
                formatted = json.dumps(obj.payload, indent=2)
                return mark_safe(f'<pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">{formatted}</pre>')
            except:
                return str(obj.payload)
        return "No payload"
    payload_formatted.short_description = 'Payload'
    
    def mark_processed(self, request, queryset):
        """Bulk mark as processed"""
        updated = queryset.update(processed=True)
        self.message_user(request, f'{updated} sync event(s) marked as processed.')
    mark_processed.short_description = 'Mark as Processed'
    
    def mark_unprocessed(self, request, queryset):
        """Bulk mark as unprocessed"""
        updated = queryset.update(processed=False)
        self.message_user(request, f'{updated} sync event(s) marked as unprocessed.')
    mark_unprocessed.short_description = 'Mark as Unprocessed'
    
    def export_to_csv(self, request, queryset):
        """Export sync events to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="sync_events.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Event Type', 'Cadet ID', 'Processed',
            'Payload', 'Created At'
        ])
        
        for event in queryset:
            writer.writerow([
                event.id, event.event_type, event.cadet_id, event.processed,
                json.dumps(event.payload) if event.payload else '',
                event.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


# Customize admin site header and title
admin.site.site_header = 'ROTC Grading System Administration'
admin.site.site_title = 'ROTC Admin'
admin.site.index_title = 'System Administration Dashboard'

