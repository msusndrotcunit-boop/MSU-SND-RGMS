from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from .models import Activity, ActivityImage


class ActivityImageInline(admin.TabularInline):
    """Inline admin for activity images"""
    model = ActivityImage
    extra = 1
    fields = ('image_url', 'image_preview', 'created_at')
    readonly_fields = ('image_preview', 'created_at')
    
    def image_preview(self, obj):
        """Display image thumbnail"""
        if obj.image_url:
            return format_html('<img src="{}" width="100" height="100" style="border-radius: 5px;" />', obj.image_url)
        return "No image"
    image_preview.short_description = 'Preview'


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for Activity model"""
    list_display = (
        'id', 'title', 'type_badge', 'date', 'image_preview', 'created_at'
    )
    list_filter = ('type', 'date', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at', 'image_preview')
    date_hierarchy = 'date'
    inlines = [ActivityImageInline]
    
    fieldsets = (
        ('Activity Information', {
            'fields': ('id', 'title', 'description', 'date', 'type')
        }),
        ('Images', {
            'fields': ('image_path', 'image_preview', 'images')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['export_to_csv', 'export_to_excel']
    
    def type_badge(self, obj):
        """Display type with color badge"""
        colors = {
            'activity': '#007bff',
            'achievement': '#28a745',
            'event': '#ffc107'
        }
        color = colors.get(obj.type, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.type.capitalize()
        )
    type_badge.short_description = 'Type'
    
    def image_preview(self, obj):
        """Display main image thumbnail"""
        if obj.image_path:
            return format_html('<img src="{}" width="100" height="100" style="border-radius: 5px;" />', obj.image_path)
        return "No image"
    image_preview.short_description = 'Main Image'
    
    def export_to_csv(self, request, queryset):
        """Export activities to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="activities.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Title', 'Type', 'Date', 'Description', 'Created At'])
        
        for activity in queryset:
            writer.writerow([
                activity.id, activity.title, activity.type, activity.date,
                activity.description, activity.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def export_to_excel(self, request, queryset):
        """Export activities to Excel"""
        from openpyxl import Workbook
        from django.http import HttpResponse
        
        wb = Workbook()
        ws = wb.active
        ws.title = 'Activities'
        
        # Headers
        headers = ['ID', 'Title', 'Type', 'Date', 'Description', 'Created At']
        ws.append(headers)
        
        # Data
        for activity in queryset:
            ws.append([
                activity.id, activity.title, activity.type, str(activity.date),
                activity.description, str(activity.created_at)
            ])
        
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="activities.xlsx"'
        wb.save(response)
        
        return response
    export_to_excel.short_description = 'Export to Excel'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(ActivityImage)
class ActivityImageAdmin(admin.ModelAdmin):
    """Admin interface for ActivityImage model"""
    list_display = ('id', 'activity', 'image_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('activity__title',)
    readonly_fields = ('id', 'created_at', 'image_preview')
    
    fieldsets = (
        ('Image Information', {
            'fields': ('id', 'activity', 'image_url', 'image_preview')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def image_preview(self, obj):
        """Display image thumbnail"""
        if obj.image_url:
            return format_html('<img src="{}" width="150" height="150" style="border-radius: 5px;" />', obj.image_url)
        return "No image"
    image_preview.short_description = 'Preview'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)

