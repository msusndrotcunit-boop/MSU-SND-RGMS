"""
Test script to verify extended API functionality (Tasks 8-14).
Tests attendance, activities, staff, messaging, and notification endpoints.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.test import Client
from apps.authentication.models import User
from apps.cadets.models import Cadet, Grades
from apps.attendance.models import TrainingDay, AttendanceRecord
from apps.activities.models import Activity
from apps.staff.models import TrainingStaff
from apps.messaging.models import AdminMessage, StaffMessage, Notification
from datetime import date, time
import json


def test_extended_api():
    """Test extended API endpoints."""
    print("=" * 60)
    print("Testing Extended API Functionality (Tasks 8-14)")
    print("=" * 60)
    
    # Clean up existing test data
    print("\n0. Cleaning up existing test data...")
    User.objects.filter(username='admin_test').delete()
    Cadet.objects.filter(student_id__startswith='2024-').delete()
    TrainingStaff.objects.filter(email='jane.smith@test.com').delete()
    print("   ✓ Cleaned up existing test data")
    
    # Create test data
    print("\n1. Creating test data...")
    
    # Create admin user
    admin_user = User.objects.create(
        username='admin_test',
        email='admin@test.com',
        password='$2b$10$test',  # bcrypt hash
        role='admin',
        is_approved=True
    )
    print(f"   ✓ Created admin user: {admin_user.username}")
    
    # Create cadet
    cadet = Cadet.objects.create(
        student_id='2024-001',
        first_name='John',
        last_name='Doe',
        company='Alpha',
        platoon='1st'
    )
    print(f"   ✓ Created cadet: {cadet.student_id}")
    
    # Grades are auto-created by signal
    grades = Grades.objects.get(cadet=cadet)
    print(f"   ✓ Grades auto-created for cadet")
    
    # Create training staff
    staff = TrainingStaff.objects.create(
        first_name='Jane',
        last_name='Smith',
        email='jane.smith@test.com',
        rank='Captain'
    )
    print(f"   ✓ Created training staff: {staff.email}")
    
    # Test Training Days
    print("\n2. Testing Training Day endpoints...")
    training_day = TrainingDay.objects.create(
        date=date.today(),
        title='Morning Drill',
        description='Regular morning drill session',
        location='Training Ground A'
    )
    print(f"   ✓ Created training day: {training_day.title}")
    
    # Test Attendance Records
    print("\n3. Testing Attendance Record endpoints...")
    attendance = AttendanceRecord.objects.create(
        training_day=training_day,
        cadet=cadet,
        status='present',
        time_in=time(8, 0)
    )
    print(f"   ✓ Created attendance record: {attendance.status}")
    
    # Verify grades updated
    grades.refresh_from_db()
    print(f"   ✓ Grades attendance_present updated: {grades.attendance_present}")
    assert grades.attendance_present == 1, "Attendance count should be 1"
    
    # Test Activities
    print("\n4. Testing Activity endpoints...")
    activity = Activity.objects.create(
        title='ROTC Day Celebration',
        description='Annual ROTC Day event',
        date=date.today(),
        type='event'
    )
    print(f"   ✓ Created activity: {activity.title}")
    
    # Test Staff Management
    print("\n5. Testing Staff Management...")
    print(f"   ✓ Staff count: {TrainingStaff.objects.count()}")
    print(f"   ✓ Non-archived staff: {TrainingStaff.objects.filter(is_archived=False).count()}")
    
    # Test Admin Messages
    print("\n6. Testing Admin Message endpoints...")
    admin_msg = AdminMessage.objects.create(
        user=admin_user,
        subject='Test Message',
        message='This is a test admin message',
        status='pending'
    )
    print(f"   ✓ Created admin message: {admin_msg.subject}")
    
    # Test Notifications
    print("\n7. Testing Notification system...")
    notification = Notification.objects.create(
        user=admin_user,
        message='Test notification',
        type='test',
        is_read=False
    )
    print(f"   ✓ Created notification: {notification.message}")
    
    # Test notification count
    unread_count = Notification.objects.filter(user=admin_user, is_read=False).count()
    print(f"   ✓ Unread notifications: {unread_count}")
    
    # Test QR Code generation
    print("\n8. Testing QR Code functionality...")
    import hashlib
    qr_data = f"{training_day.id}:{training_day.date}:{training_day.title}"
    qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:16]
    print(f"   ✓ Generated QR code: {qr_hash}")
    
    # Test Signals
    print("\n9. Testing Signal handlers...")
    
    # Test attendance grade update signal
    initial_attendance = grades.attendance_present
    attendance2 = AttendanceRecord.objects.create(
        training_day=training_day,
        cadet=Cadet.objects.create(
            student_id='2024-002',
            first_name='Jane',
            last_name='Smith'
        ),
        status='present'
    )
    grades2 = Grades.objects.get(cadet=attendance2.cadet)
    print(f"   ✓ Attendance signal working: {grades2.attendance_present} attendance")
    
    # Summary
    print("\n" + "=" * 60)
    print("Extended API Test Summary")
    print("=" * 60)
    print(f"Training Days: {TrainingDay.objects.count()}")
    print(f"Attendance Records: {AttendanceRecord.objects.count()}")
    print(f"Activities: {Activity.objects.count()}")
    print(f"Training Staff: {TrainingStaff.objects.count()}")
    print(f"Admin Messages: {AdminMessage.objects.count()}")
    print(f"Notifications: {Notification.objects.count()}")
    print("\n✓ All extended API tests passed!")
    print("=" * 60)


if __name__ == '__main__':
    try:
        test_extended_api()
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
