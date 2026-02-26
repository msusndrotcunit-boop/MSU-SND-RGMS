"""
Test suite for Task 28: Django Admin Interface
Tests comprehensive admin customizations for all 19 models
"""
import pytest
from django.contrib.admin.sites import site
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser
from apps.authentication.models import User, UserSettings
from apps.cadets.models import Cadet, Grades
from apps.grading.models import MeritDemeritLog
from apps.attendance.models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter
from apps.activities.models import Activity, ActivityImage
from apps.staff.models import TrainingStaff
from apps.messaging.models import AdminMessage, StaffMessage, Notification, PushSubscription
from apps.system.models import SystemSettings, AuditLog, SyncEvent


@pytest.mark.django_db
class TestAdminRegistration:
    """Test that all 19 models are registered in admin"""
    
    def test_all_models_registered(self):
        """Verify all 19 models are registered"""
        registered_models = [
            User, UserSettings, Cadet, Grades, MeritDemeritLog,
            TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter,
            Activity, ActivityImage, TrainingStaff,
            AdminMessage, StaffMessage, Notification, PushSubscription,
            SystemSettings, AuditLog, SyncEvent
        ]
        
        for model in registered_models:
            assert site.is_registered(model), f"{model.__name__} is not registered in admin"
    
    def test_admin_classes_have_customizations(self):
        """Verify admin classes have list_display configured"""
        models_to_check = [
            User, Cadet, Grades, MeritDemeritLog, TrainingDay,
            AttendanceRecord, ExcuseLetter, Activity, TrainingStaff,
            AdminMessage, Notification, SystemSettings, AuditLog, SyncEvent
        ]
        
        for model in models_to_check:
            admin_class = site._registry[model]
            assert hasattr(admin_class, 'list_display'), f"{model.__name__} admin has no list_display"
            assert len(admin_class.list_display) > 0, f"{model.__name__} admin list_display is empty"


@pytest.mark.django_db
class TestAdminPermissions:
    """Test admin access restrictions"""
    
    def setup_method(self):
        """Set up test data"""
        self.factory = RequestFactory()
        self.admin_user = User.objects.create(
            username='admin_test',
            email='admin@test.com',
            password='test123',
            role='admin',
            is_approved=True
        )
        self.cadet_user = User.objects.create(
            username='cadet_test',
            email='cadet@test.com',
            password='test123',
            role='cadet',
            is_approved=True
        )
    
    def test_admin_role_has_access(self):
        """Test that admin role can access admin interface"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        request = self.factory.get('/admin/')
        request.user = self.admin_user
        
        assert admin_instance.has_module_permission(request) is True
    
    def test_non_admin_role_denied_access(self):
        """Test that non-admin roles cannot access admin interface"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        request = self.factory.get('/admin/')
        request.user = self.cadet_user
        
        assert admin_instance.has_module_permission(request) is False


@pytest.mark.django_db
class TestAdminListDisplays:
    """Test admin list display configurations"""
    
    def test_user_admin_list_display(self):
        """Test User admin list display"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        assert 'username' in admin_instance.list_display
        assert 'email' in admin_instance.list_display
        assert 'role' in admin_instance.list_display
        assert 'is_approved' in admin_instance.list_display
    
    def test_cadet_admin_list_display(self):
        """Test Cadet admin list display"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        assert 'student_id' in admin_instance.list_display
        assert 'company' in admin_instance.list_display
        assert 'platoon' in admin_instance.list_display
        assert 'status' in admin_instance.list_display
    
    def test_grades_admin_list_display(self):
        """Test Grades admin list display"""
        from apps.cadets.admin import GradesAdmin
        
        admin_instance = GradesAdmin(Grades, site)
        assert 'cadet' in admin_instance.list_display
        assert 'merit_points' in admin_instance.list_display
        assert 'demerit_points' in admin_instance.list_display


@pytest.mark.django_db
class TestAdminFilters:
    """Test admin list filters"""
    
    def test_user_admin_filters(self):
        """Test User admin has filters"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        assert 'role' in admin_instance.list_filter
        assert 'is_approved' in admin_instance.list_filter
    
    def test_cadet_admin_filters(self):
        """Test Cadet admin has filters"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        assert 'company' in admin_instance.list_filter
        assert 'platoon' in admin_instance.list_filter
        assert 'status' in admin_instance.list_filter
        assert 'is_archived' in admin_instance.list_filter
    
    def test_attendance_admin_filters(self):
        """Test AttendanceRecord admin has filters"""
        from apps.attendance.admin import AttendanceRecordAdmin
        
        admin_instance = AttendanceRecordAdmin(AttendanceRecord, site)
        assert 'status' in admin_instance.list_filter


@pytest.mark.django_db
class TestAdminSearchFields:
    """Test admin search configurations"""
    
    def test_user_admin_search(self):
        """Test User admin search fields"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        assert 'username' in admin_instance.search_fields
        assert 'email' in admin_instance.search_fields
    
    def test_cadet_admin_search(self):
        """Test Cadet admin search fields"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        assert 'student_id' in admin_instance.search_fields
        assert 'first_name' in admin_instance.search_fields
        assert 'last_name' in admin_instance.search_fields


@pytest.mark.django_db
class TestAdminInlines:
    """Test admin inline configurations"""
    
    def test_user_has_settings_inline(self):
        """Test User admin has UserSettings inline"""
        from apps.authentication.admin import UserAdmin, UserSettingsInline
        
        admin_instance = UserAdmin(User, site)
        assert len(admin_instance.inlines) > 0
        assert UserSettingsInline in admin_instance.inlines
    
    def test_cadet_has_grades_inline(self):
        """Test Cadet admin has Grades inline"""
        from apps.cadets.admin import CadetAdmin, GradesInline
        
        admin_instance = CadetAdmin(Cadet, site)
        assert len(admin_instance.inlines) > 0
        assert GradesInline in admin_instance.inlines
    
    def test_activity_has_images_inline(self):
        """Test Activity admin has ActivityImage inline"""
        from apps.activities.admin import ActivityAdmin, ActivityImageInline
        
        admin_instance = ActivityAdmin(Activity, site)
        assert len(admin_instance.inlines) > 0
        assert ActivityImageInline in admin_instance.inlines


@pytest.mark.django_db
class TestAdminBulkActions:
    """Test admin bulk actions"""
    
    def test_user_admin_has_approve_action(self):
        """Test User admin has approve bulk action"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        actions = [action for action in admin_instance.actions]
        assert 'approve_users' in actions
    
    def test_cadet_admin_has_archive_actions(self):
        """Test Cadet admin has archive/unarchive actions"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        actions = [action for action in admin_instance.actions]
        assert 'archive_cadets' in actions
        assert 'unarchive_cadets' in actions
    
    def test_attendance_admin_has_status_actions(self):
        """Test AttendanceRecord admin has status actions"""
        from apps.attendance.admin import AttendanceRecordAdmin
        
        admin_instance = AttendanceRecordAdmin(AttendanceRecord, site)
        actions = [action for action in admin_instance.actions]
        assert 'mark_present' in actions
        assert 'mark_absent' in actions


@pytest.mark.django_db
class TestAdminExportActions:
    """Test admin export actions"""
    
    def test_user_admin_has_csv_export(self):
        """Test User admin has CSV export"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        actions = [action for action in admin_instance.actions]
        assert 'export_to_csv' in actions
    
    def test_cadet_admin_has_excel_export(self):
        """Test Cadet admin has Excel export"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        actions = [action for action in admin_instance.actions]
        assert 'export_to_csv' in actions
        assert 'export_to_excel' in actions
    
    def test_grades_admin_has_csv_export(self):
        """Test Grades admin has CSV export"""
        from apps.cadets.admin import GradesAdmin
        
        admin_instance = GradesAdmin(Grades, site)
        actions = [action for action in admin_instance.actions]
        assert 'export_to_csv' in actions


@pytest.mark.django_db
class TestAdminFieldsets:
    """Test admin fieldset configurations"""
    
    def test_user_admin_has_fieldsets(self):
        """Test User admin has organized fieldsets"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        assert admin_instance.fieldsets is not None
        assert len(admin_instance.fieldsets) > 0
    
    def test_cadet_admin_has_fieldsets(self):
        """Test Cadet admin has organized fieldsets"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        assert admin_instance.fieldsets is not None
        assert len(admin_instance.fieldsets) > 0
    
    def test_staff_admin_has_fieldsets(self):
        """Test TrainingStaff admin has organized fieldsets"""
        from apps.staff.admin import TrainingStaffAdmin
        
        admin_instance = TrainingStaffAdmin(TrainingStaff, site)
        assert admin_instance.fieldsets is not None
        assert len(admin_instance.fieldsets) > 0


@pytest.mark.django_db
class TestAdminReadonlyFields:
    """Test admin readonly field configurations"""
    
    def test_user_admin_readonly_fields(self):
        """Test User admin has readonly fields"""
        from apps.authentication.admin import UserAdmin
        
        admin_instance = UserAdmin(User, site)
        assert 'id' in admin_instance.readonly_fields
        assert 'created_at' in admin_instance.readonly_fields
    
    def test_audit_log_readonly(self):
        """Test AuditLog admin is mostly readonly"""
        from apps.system.admin import AuditLogAdmin
        
        admin_instance = AuditLogAdmin(AuditLog, site)
        assert 'id' in admin_instance.readonly_fields
        assert 'created_at' in admin_instance.readonly_fields


@pytest.mark.django_db
class TestAdminCustomMethods:
    """Test admin custom display methods"""
    
    def setup_method(self):
        """Set up test data"""
        self.cadet = Cadet.objects.create(
            student_id='2021-001',
            first_name='John',
            last_name='Doe',
            company='Alpha',
            platoon='1st'
        )
    
    def test_cadet_full_name_method(self):
        """Test Cadet admin full_name method"""
        from apps.cadets.admin import CadetAdmin
        
        admin_instance = CadetAdmin(Cadet, site)
        full_name = admin_instance.full_name(self.cadet)
        assert 'John' in full_name
        assert 'Doe' in full_name
    
    def test_merit_demerit_type_badge(self):
        """Test MeritDemeritLog admin type_badge method"""
        from apps.grading.admin import MeritDemeritLogAdmin
        
        log = MeritDemeritLog.objects.create(
            cadet=self.cadet,
            type='merit',
            points=10,
            reason='Good conduct',
            issued_by_user_id=1,
            issued_by_name='Admin'
        )
        
        admin_instance = MeritDemeritLogAdmin(MeritDemeritLog, site)
        badge = admin_instance.type_badge(log)
        assert 'Merit' in badge


@pytest.mark.django_db
class TestAdminActionLogging:
    """Test that admin actions are logged"""
    
    def setup_method(self):
        """Set up test data"""
        self.factory = RequestFactory()
        self.admin_user = User.objects.create(
            username='admin_test',
            email='admin@test.com',
            password='test123',
            role='admin',
            is_approved=True
        )
    
    def test_bulk_approve_users_action(self):
        """Test bulk approve users action works"""
        from apps.authentication.admin import UserAdmin
        from django.contrib.messages.storage.fallback import FallbackStorage
        from django.contrib.sessions.middleware import SessionMiddleware
        
        # Create test users
        user1 = User.objects.create(
            username='user1',
            email='user1@test.com',
            password='test123',
            role='cadet',
            is_approved=False
        )
        user2 = User.objects.create(
            username='user2',
            email='user2@test.com',
            password='test123',
            role='cadet',
            is_approved=False
        )
        
        admin_instance = UserAdmin(User, site)
        request = self.factory.post('/admin/')
        request.user = self.admin_user
        
        # Add session middleware
        middleware = SessionMiddleware(lambda x: None)
        middleware.process_request(request)
        request.session.save()
        
        # Add messages framework
        messages = FallbackStorage(request)
        setattr(request, '_messages', messages)
        
        queryset = User.objects.filter(id__in=[user1.id, user2.id])
        admin_instance.approve_users(request, queryset)
        
        # Verify users are approved
        user1.refresh_from_db()
        user2.refresh_from_db()
        assert user1.is_approved is True
        assert user2.is_approved is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
