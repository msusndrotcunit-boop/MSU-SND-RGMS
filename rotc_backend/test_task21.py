"""
Test script for Task 21: Audit logging and sync events
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.system.models import AuditLog, SyncEvent
from apps.cadets.models import Cadet, Grades
from apps.authentication.models import User
from django.contrib.auth.hashers import make_password


def test_audit_logging():
    """Test that audit logs are created for model operations."""
    print("\n=== Testing Audit Logging ===")
    
    # Get initial count
    initial_count = AuditLog.objects.count()
    print(f"Initial audit log count: {initial_count}")
    
    # Create a test cadet (should trigger audit log)
    test_cadet = Cadet.objects.create(
        student_id=f"TEST-AUDIT-{initial_count}",
        first_name="Test",
        last_name="Audit",
        company="Alpha",
        platoon="1st"
    )
    print(f"Created test cadet: {test_cadet.student_id}")
    
    # Check if audit log was created
    new_count = AuditLog.objects.count()
    print(f"New audit log count: {new_count}")
    
    if new_count > initial_count:
        print("✓ Audit log created successfully")
        latest_log = AuditLog.objects.latest('created_at')
        print(f"  - Table: {latest_log.table_name}")
        print(f"  - Operation: {latest_log.operation}")
        print(f"  - Record ID: {latest_log.record_id}")
        print(f"  - Payload keys: {list(latest_log.payload.keys())}")
    else:
        print("✗ Audit log was NOT created")
    
    # Update the cadet (should trigger another audit log)
    test_cadet.company = "Bravo"
    test_cadet.save()
    print(f"Updated test cadet company to: {test_cadet.company}")
    
    update_count = AuditLog.objects.count()
    if update_count > new_count:
        print("✓ Update audit log created successfully")
    else:
        print("✗ Update audit log was NOT created")
    
    # Clean up
    test_cadet.delete()
    delete_count = AuditLog.objects.count()
    if delete_count > update_count:
        print("✓ Delete audit log created successfully")
    else:
        print("✗ Delete audit log was NOT created")
    
    return True


def test_sync_events():
    """Test that sync events are created for grade-related changes."""
    print("\n=== Testing Sync Events ===")
    
    # Get initial count
    initial_count = SyncEvent.objects.count()
    print(f"Initial sync event count: {initial_count}")
    
    # Create a test cadet with grades
    test_cadet = Cadet.objects.create(
        student_id=f"TEST-SYNC-{initial_count}",
        first_name="Test",
        last_name="Sync",
        company="Charlie",
        platoon="2nd"
    )
    print(f"Created test cadet: {test_cadet.student_id}")
    
    # Get or create grades
    grades, created = Grades.objects.get_or_create(cadet=test_cadet)
    print(f"Grades {'created' if created else 'retrieved'}")
    
    # Update grades (should trigger sync event)
    grades.prelim_score = 85.5
    grades.save()
    print(f"Updated prelim score to: {grades.prelim_score}")
    
    # Check if sync event was created
    new_count = SyncEvent.objects.count()
    print(f"New sync event count: {new_count}")
    
    if new_count > initial_count:
        print("✓ Sync event created successfully")
        latest_event = SyncEvent.objects.latest('created_at')
        print(f"  - Event type: {latest_event.event_type}")
        print(f"  - Cadet ID: {latest_event.cadet_id}")
        print(f"  - Processed: {latest_event.processed}")
        print(f"  - Payload keys: {list(latest_event.payload.keys())}")
    else:
        print("✗ Sync event was NOT created")
    
    # Clean up
    test_cadet.delete()
    
    return True


def test_audit_log_filtering():
    """Test audit log filtering."""
    print("\n=== Testing Audit Log Filtering ===")
    
    # Get all audit logs
    all_logs = AuditLog.objects.all()
    print(f"Total audit logs: {all_logs.count()}")
    
    # Filter by table name
    cadet_logs = AuditLog.objects.filter(table_name='cadets')
    print(f"Cadet audit logs: {cadet_logs.count()}")
    
    # Filter by operation
    create_logs = AuditLog.objects.filter(operation='CREATE')
    print(f"CREATE operation logs: {create_logs.count()}")
    
    update_logs = AuditLog.objects.filter(operation='UPDATE')
    print(f"UPDATE operation logs: {update_logs.count()}")
    
    delete_logs = AuditLog.objects.filter(operation='DELETE')
    print(f"DELETE operation logs: {delete_logs.count()}")
    
    # Show recent logs
    recent_logs = AuditLog.objects.order_by('-created_at')[:5]
    print("\nRecent audit logs:")
    for log in recent_logs:
        print(f"  - {log.created_at.strftime('%Y-%m-%d %H:%M:%S')} | {log.table_name} | {log.operation} | ID:{log.record_id}")
    
    return True


def test_sync_event_filtering():
    """Test sync event filtering."""
    print("\n=== Testing Sync Event Filtering ===")
    
    # Get all sync events
    all_events = SyncEvent.objects.all()
    print(f"Total sync events: {all_events.count()}")
    
    # Filter by processed status
    unprocessed = SyncEvent.objects.filter(processed=False)
    print(f"Unprocessed sync events: {unprocessed.count()}")
    
    processed = SyncEvent.objects.filter(processed=True)
    print(f"Processed sync events: {processed.count()}")
    
    # Filter by event type
    grade_updates = SyncEvent.objects.filter(event_type='grade_update')
    print(f"Grade update events: {grade_updates.count()}")
    
    exam_updates = SyncEvent.objects.filter(event_type='exam_score_update')
    print(f"Exam score update events: {exam_updates.count()}")
    
    attendance_updates = SyncEvent.objects.filter(event_type='attendance_update')
    print(f"Attendance update events: {attendance_updates.count()}")
    
    # Show recent events
    recent_events = SyncEvent.objects.order_by('-created_at')[:5]
    print("\nRecent sync events:")
    for event in recent_events:
        print(f"  - {event.created_at.strftime('%Y-%m-%d %H:%M:%S')} | {event.event_type} | Cadet:{event.cadet_id} | Processed:{event.processed}")
    
    return True


def test_sensitive_field_exclusion():
    """Test that sensitive fields are excluded from audit logs."""
    print("\n=== Testing Sensitive Field Exclusion ===")
    
    # Create a test user (should trigger audit log without password)
    test_user = User.objects.create(
        username=f"test_audit_user_{AuditLog.objects.count()}",
        email=f"test_audit_{AuditLog.objects.count()}@example.com",
        password=make_password("test_password_123"),
        role="cadet"
    )
    print(f"Created test user: {test_user.username}")
    
    # Find the audit log for this user
    user_log = AuditLog.objects.filter(
        table_name='users',
        record_id=test_user.id,
        operation='CREATE'
    ).first()
    
    if user_log:
        print("✓ User audit log found")
        if 'password' in user_log.payload:
            print("✗ WARNING: Password field is present in audit log payload!")
            print(f"  Password value: {user_log.payload['password'][:20]}...")
        else:
            print("✓ Password field correctly excluded from audit log")
        
        print(f"  Payload keys: {list(user_log.payload.keys())}")
    else:
        print("✗ User audit log not found")
    
    # Clean up
    test_user.delete()
    
    return True


if __name__ == '__main__':
    print("=" * 60)
    print("Task 21: Audit Logging and Sync Events - Test Suite")
    print("=" * 60)
    
    try:
        test_audit_logging()
        test_sync_events()
        test_audit_log_filtering()
        test_sync_event_filtering()
        test_sensitive_field_exclusion()
        
        print("\n" + "=" * 60)
        print("All tests completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Error during testing: {e}")
        import traceback
        traceback.print_exc()
