from django.contrib import admin
from apps.authentication.admin_utils import is_admin_user
from django.utils.html import format_html
from .models import Cadet, Grades


class GradesInline(admin.StackedInline):
    """Inline admin for grades"""
    model = Grades
    can_delete = False
    verbose_name_plural = 'Grades'
    fields = (
        'attendance_present', 'merit_points', 'demerit_points',
        'prelim_score', 'midterm_score', 'final_score'
    )


@admin.register(Cadet)
class CadetAdmin(admin.ModelAdmin):
    """Comprehensive admin interface for Cadet model"""
    list_display = (
        'id', 'student_id', 'full_name', 'company', 'platoon',
        'course', 'year_level', 'status', 'is_archived'
    )
    list_filter = ('company', 'platoon', 'year_level', 'status', 'is_archived', 'is_profile_completed')
    search_fields = ('student_id', 'first_name', 'last_name', 'email')
    readonly_fields = ('id', 'created_at', 'profile_pic_preview')
    inlines = [GradesInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'student_id', 'first_name', 'middle_name', 'last_name', 'suffix_name')
        }),
        ('Academic Information', {
            'fields': ('company', 'platoon', 'course', 'year_level', 'status')
        }),
        ('Contact Information', {
            'fields': ('email', 'contact_number')
        }),
        ('Profile Picture', {
            'fields': ('profile_pic', 'profile_pic_preview')
        }),
        ('Personal Information', {
            'fields': (
                'birthdate', 'birthplace', 'age', 'gender', 'civil_status',
                'nationality', 'blood_type', 'height', 'weight', 'address'
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
        ('Status', {
            'fields': ('is_profile_completed', 'is_archived', 'created_at')
        }),
    )
    
    actions = ['archive_cadets', 'unarchive_cadets', 'export_to_csv', 'export_to_excel']
    
    def full_name(self, obj):
        """Display full name"""
        parts = [obj.first_name]
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
    
    def archive_cadets(self, request, queryset):
        """Bulk archive cadets"""
        updated = queryset.update(is_archived=True)
        self.message_user(request, f'{updated} cadet(s) archived successfully.')
    archive_cadets.short_description = 'Archive selected cadets'
    
    def unarchive_cadets(self, request, queryset):
        """Bulk unarchive cadets"""
        updated = queryset.update(is_archived=False)
        self.message_user(request, f'{updated} cadet(s) unarchived successfully.')
    unarchive_cadets.short_description = 'Unarchive selected cadets'
    
    def export_to_csv(self, request, queryset):
        """Export selected cadets to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="cadets.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Student ID', 'First Name', 'Last Name', 'Company',
            'Platoon', 'Course', 'Year Level', 'Status', 'Email'
        ])
        
        for cadet in queryset:
            writer.writerow([
                cadet.id, cadet.student_id, cadet.first_name, cadet.last_name,
                cadet.company, cadet.platoon, cadet.course, cadet.year_level,
                cadet.status, cadet.email
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def export_to_excel(self, request, queryset):
        """Export selected cadets to Excel"""
        from openpyxl import Workbook
        from django.http import HttpResponse
        
        wb = Workbook()
        ws = wb.active
        ws.title = 'Cadets'
        
        # Headers
        headers = [
            'ID', 'Student ID', 'First Name', 'Last Name', 'Company',
            'Platoon', 'Course', 'Year Level', 'Status', 'Email'
        ]
        ws.append(headers)
        
        # Data
        for cadet in queryset:
            ws.append([
                cadet.id, cadet.student_id, cadet.first_name, cadet.last_name,
                cadet.company, cadet.platoon, cadet.course, cadet.year_level,
                cadet.status, cadet.email
            ])
        
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="cadets.xlsx"'
        wb.save(response)
        
        return response
    export_to_excel.short_description = 'Export to Excel'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)


@admin.register(Grades)
class GradesAdmin(admin.ModelAdmin):
    """Admin interface for Grades model"""
    list_display = (
        'id', 'cadet', 'attendance_present', 'merit_points',
        'demerit_points', 'prelim_score', 'midterm_score', 'final_score'
    )
    list_filter = ('cadet__company', 'cadet__platoon')
    search_fields = ('cadet__student_id', 'cadet__first_name', 'cadet__last_name')
    readonly_fields = ('id',)
    
    fieldsets = (
        ('Cadet', {
            'fields': ('id', 'cadet')
        }),
        ('Attendance & Behavior', {
            'fields': ('attendance_present', 'merit_points', 'demerit_points')
        }),
        ('Academic Scores', {
            'fields': ('prelim_score', 'midterm_score', 'final_score')
        }),
    )
    
    actions = ['export_to_csv']
    
    def export_to_csv(self, request, queryset):
        """Export grades to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="grades.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Cadet ID', 'Student ID', 'Name', 'Attendance', 'Merit Points',
            'Demerit Points', 'Prelim', 'Midterm', 'Final'
        ])
        
        for grade in queryset:
            writer.writerow([
                grade.cadet.id, grade.cadet.student_id,
                f"{grade.cadet.first_name} {grade.cadet.last_name}",
                grade.attendance_present, grade.merit_points, grade.demerit_points,
                grade.prelim_score, grade.midterm_score, grade.final_score
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
    
    def has_module_permission(self, request):
        """Only allow admin role to access"""
        return is_admin_user(request.user)

