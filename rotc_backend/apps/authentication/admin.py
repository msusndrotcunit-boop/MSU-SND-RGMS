from django.contrib import admin
from django.contrib.auth.hashers import make_password
from django.utils.html import format_html
from .models import User, UserSettings
from .admin_utils import is_admin_user


class UserSettingsInline(admin.StackedInline):
    """Inline admin for user settings"""
    model = UserSettings
    can_delete = False
    verbose_name_plural = 'Settings'
    fields = (
        'email_alerts', 'push_notifications', 'activity_updates',
        'dark_mode', 'compact_mode', 'primary_color', 'custom_bg'
    )


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for User model"""
    list_display = (
        'id', 'username', 'email', 'role', 'is_approved',
        'profile_pic_preview', 'created_at'
    )
    list_filter = ('role', 'is_approved', 'created_at')
    search_fields = ('username', 'email', 'id')
    readonly_fields = ('id', 'created_at', 'last_location_at', 'profile_pic_preview')
    inlines = [UserSettingsInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'username', 'email', 'password', 'role', 'is_approved')
        }),
        ('Profile', {
            'fields': ('profile_pic', 'profile_pic_preview')
        }),
        ('Relationships', {
            'fields': ('cadet_id', 'staff_id')
        }),
        ('Location Tracking', {
            'fields': ('last_latitude', 'last_longitude', 'last_location_at'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['approve_users', 'unapprove_users', 'export_to_csv']
    
    def profile_pic_preview(self, obj):
        """Display profile picture thumbnail"""
        if obj.profile_pic:
            return format_html('<img src="{}" width="50" height="50" style="border-radius: 50%;" />', obj.profile_pic)
        return "No image"
    profile_pic_preview.short_description = 'Profile Picture'
    
    def approve_users(self, request, queryset):
        """Bulk approve users"""
        updated = queryset.update(is_approved=True)
        self.message_user(request, f'{updated} user(s) approved successfully.')
    approve_users.short_description = 'Approve selected users'
    
    def unapprove_users(self, request, queryset):
        """Bulk unapprove users"""
        updated = queryset.update(is_approved=False)
        self.message_user(request, f'{updated} user(s) unapproved.')
    unapprove_users.short_description = 'Unapprove selected users'
    
    def export_to_csv(self, request, queryset):
        """Export selected users to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="users.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Username', 'Email', 'Role', 'Is Approved', 'Created At'])
        
        for user in queryset:
            writer.writerow([
                user.id, user.username, user.email, user.role,
                user.is_approved, user.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)
    
    def has_view_permission(self, request, obj=None):
        """Only allow admin role to view"""
        return is_admin_user(request.user)
    
    def has_change_permission(self, request, obj=None):
        """Only allow admin role to change"""
        return is_admin_user(request.user)
    
    def has_delete_permission(self, request, obj=None):
        """Only allow admin role to delete"""
        return is_admin_user(request.user)


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    """Admin interface for UserSettings model"""
    list_display = (
        'id', 'user', 'email_alerts', 'push_notifications',
        'dark_mode', 'primary_color'
    )
    list_filter = ('email_alerts', 'push_notifications', 'dark_mode')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('id',)
    
    fieldsets = (
        ('User', {
            'fields': ('id', 'user')
        }),
        ('Notification Preferences', {
            'fields': ('email_alerts', 'push_notifications', 'activity_updates')
        }),
        ('Display Preferences', {
            'fields': ('dark_mode', 'compact_mode', 'primary_color', 'custom_bg')
        }),
    )
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)
