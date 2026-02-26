from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from .models import TrainingStaff


@admin.register(TrainingStaff)
class TrainingStaffAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for TrainingStaff model"""
    list_display = (
        'id', 'full_name', 'rank', 'email', 'role',
        'is_archived', 'is_profile_completed'
    )
    list_filter = ('rank', 'role', 'is_archived', 'is_profile_completed', 'gender')
    search_fields = ('first_name', 'last_name', 'email', 'afpsn')
    readonly_fields = ('id', 'created_at', 'profile_pic_preview')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'first_name', 'middle_name', 'last_name', 'suffix_name', 'rank')
        }),
        ('Contact Information', {
            'fields': ('email', 'contact_number')
        }),
        ('Role & Status', {
            'fields': ('role', 'is_profile_completed', 'has_seen_guide', 'is_archived')
        }),
        ('Profile Picture', {
            'fields': ('profile_pic', 'profile_pic_preview')
        }),
        ('Personal Information', {
            'fields': (
                'afpsn', 'birthdate', 'birthplace', 'age', 'gender',
                'civil_status', 'nationality', 'blood_type', 'height', 'weight', 'address'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Details', {
            'fields': (
                'language_spoken', 'facebook_link', 'rotc_unit',
                'mobilization_center', 'combat_boots_size', 'uniform_size', 'bullcap_size'
            ),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['archive_staff', 'unarchive_staff', 'export_to_csv', 'export_to_excel']
    
    def full_name(self, obj):
        """Display full name"""
        parts = []
        if obj.rank:
            parts.append(obj.rank)
        parts.append(obj.first_name)
        if obj.middle_name:
            parts.append(obj.middle_name)
        parts.append(obj.last_name)
        if obj.suffix_name:
            parts.append(obj.suffix_name)
        return ' '.join(parts)
    full_name.short_description = 'Full Name'
    
    def profile_pic_preview(self, obj):
        """Display profile picture thumbnail"""
        if obj.profile_pic:
            return format_html('<img src="{}" width="100" height="100" style="border-radius: 10px;" />', obj.profile_pic)
        return "No image"
    profile_pic_preview.short_description = 'Profile Picture'
    
    def archive_staff(self, request, queryset):
        """Bulk archive staff"""
        updated = queryset.update(is_archived=True)
        self.message_user(request, f'{updated} staff member(s) archived successfully.')
    archive_staff.short_description = 'Archive selected staff'
    
    def unarchive_staff(self, request, queryset):
        """Bulk unarchive staff"""
        updated = queryset.update(is_archived=False)
        self.message_user(request, f'{updated} staff member(s) unarchived successfully.')
    unarchive_staff.short_description = 'Unarchive selected staff'
    
    def export_to_csv(self, request, queryset):
        """Export staff to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="training_staff.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'First Name', 'Last Name', 'Rank', 'Email',
            'Contact Number', 'Role', 'AFPSN'
        ])
        
        for staff in queryset:
            writer.writerow([
                staff.id, staff.first_name, staff.last_name, staff.rank,
                staff.email, staff.contact_number, staff.role, staff.afpsn
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def export_to_excel(self, request, queryset):
        """Export staff to Excel"""
        from openpyxl import Workbook
        from django.http import HttpResponse
        
        wb = Workbook()
        ws = wb.active
        ws.title = 'Training Staff'
        
        # Headers
        headers = [
            'ID', 'First Name', 'Last Name', 'Rank', 'Email',
            'Contact Number', 'Role', 'AFPSN'
        ]
        ws.append(headers)
        
        # Data
        for staff in queryset:
            ws.append([
                staff.id, staff.first_name, staff.last_name, staff.rank,
                staff.email, staff.contact_number, staff.role, staff.afpsn
            ])
        
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="training_staff.xlsx"'
        wb.save(response)
        
        return response
    export_to_excel.short_description = 'Export to Excel'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)

