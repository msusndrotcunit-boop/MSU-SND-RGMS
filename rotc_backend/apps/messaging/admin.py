from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from .models import AdminMessage, StaffMessage, Notification, PushSubscription


@admin.register(AdminMessage)
class AdminMessageAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for AdminMessage model"""
    list_display = (
        'id', 'user', 'subject', 'status_badge', 'created_at'
    )
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'user__email', 'subject', 'message')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Message Information', {
            'fields': ('id', 'user', 'subject', 'message', 'status')
        }),
        ('Admin Reply', {
            'fields': ('admin_reply',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['mark_replied', 'mark_pending', 'export_to_csv']
    
    def status_badge(self, obj):
        """Display status with color badge"""
        colors = {
            'pending': '#ffc107',
            'replied': '#28a745'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.status.capitalize()
        )
    status_badge.short_description = 'Status'
    
    def mark_replied(self, request, queryset):
        """Bulk mark as replied"""
        updated = queryset.update(status='replied')
        self.message_user(request, f'{updated} message(s) marked as replied.')
    mark_replied.short_description = 'Mark as Replied'
    
    def mark_pending(self, request, queryset):
        """Bulk mark as pending"""
        updated = queryset.update(status='pending')
        self.message_user(request, f'{updated} message(s) marked as pending.')
    mark_pending.short_description = 'Mark as Pending'
    
    def export_to_csv(self, request, queryset):
        """Export admin messages to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="admin_messages.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'User', 'Subject', 'Message', 'Status',
            'Admin Reply', 'Created At'
        ])
        
        for msg in queryset:
            writer.writerow([
                msg.id, msg.user.username, msg.subject, msg.message,
                msg.status, msg.admin_reply, msg.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(StaffMessage)
class StaffMessageAdmin(admin.ModelAdmin):
    """Admin interface for StaffMessage model"""
    list_display = ('id', 'sender_staff', 'content_short', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('sender_staff__first_name', 'sender_staff__last_name', 'content')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Message Information', {
            'fields': ('id', 'sender_staff', 'content')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['export_to_csv']
    
    def content_short(self, obj):
        """Display shortened content"""
        if len(obj.content) > 50:
            return obj.content[:50] + '...'
        return obj.content
    content_short.short_description = 'Content'
    
    def export_to_csv(self, request, queryset):
        """Export staff messages to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="staff_messages.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Sender', 'Content', 'Created At'])
        
        for msg in queryset:
            writer.writerow([
                msg.id,
                f"{msg.sender_staff.first_name} {msg.sender_staff.last_name}",
                msg.content, msg.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for Notification model"""
    list_display = (
        'id', 'user', 'type', 'message_short', 'is_read_badge', 'created_at'
    )
    list_filter = ('type', 'is_read', 'created_at')
    search_fields = ('user__username', 'user__email', 'message', 'type')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Notification Information', {
            'fields': ('id', 'user', 'type', 'message', 'is_read')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['mark_read', 'mark_unread', 'export_to_csv']
    
    def message_short(self, obj):
        """Display shortened message"""
        if len(obj.message) > 50:
            return obj.message[:50] + '...'
        return obj.message
    message_short.short_description = 'Message'
    
    def is_read_badge(self, obj):
        """Display read status with badge"""
        if obj.is_read:
            return format_html(
                '<span style="background-color: #28a745; color: white; padding: 3px 8px; border-radius: 3px;">Read</span>'
            )
        else:
            return format_html(
                '<span style="background-color: #dc3545; color: white; padding: 3px 8px; border-radius: 3px;">Unread</span>'
            )
    is_read_badge.short_description = 'Status'
    
    def mark_read(self, request, queryset):
        """Bulk mark as read"""
        updated = queryset.update(is_read=True)
        self.message_user(request, f'{updated} notification(s) marked as read.')
    mark_read.short_description = 'Mark as Read'
    
    def mark_unread(self, request, queryset):
        """Bulk mark as unread"""
        updated = queryset.update(is_read=False)
        self.message_user(request, f'{updated} notification(s) marked as unread.')
    mark_unread.short_description = 'Mark as Unread'
    
    def export_to_csv(self, request, queryset):
        """Export notifications to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="notifications.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'User', 'Type', 'Message', 'Is Read', 'Created At'])
        
        for notif in queryset:
            writer.writerow([
                notif.id, notif.user.username, notif.type, notif.message,
                notif.is_read, notif.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    """Admin interface for PushSubscription model"""
    list_display = ('id', 'user', 'endpoint_short', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'user__email', 'endpoint')
    readonly_fields = ('id', 'created_at')
    
    fieldsets = (
        ('Subscription Information', {
            'fields': ('id', 'user', 'endpoint', 'keys')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def endpoint_short(self, obj):
        """Display shortened endpoint"""
        if len(obj.endpoint) > 50:
            return obj.endpoint[:50] + '...'
        return obj.endpoint
    endpoint_short.short_description = 'Endpoint'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)

