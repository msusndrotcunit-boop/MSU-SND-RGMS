"""
Simple test script to verify API endpoints.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.authentication.models import User, UserSettings
from apps.cadets.models import Cadet, Grades
from apps.grading.models import MeritDemeritLog
import bcrypt


def test_user_creation():
    """Test creating a user with bcrypt password."""
    print("\n=== Testing User Creation ===")
    
    # Create a test user
    password = "testpassword123"
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=10))
    
    user = User.objects.create(
        username="testadmin",
        email="admin@test.com",
        password=hashed_password.decode('utf-8'),
        role="admin",
        is_approved=True
    )
    
    # Create user settings
    UserSettings.objects.create(user=user)
    
    print(f"✓ Created user: {user.username} (ID: {user.id})")
    
    # Verify password
    is_valid = bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8'))
    print(f"✓ Password verification: {'PASS' if is_valid else 'FAIL'}")
    
    return user


def test_cadet_creation():
    """Test creating a cadet with automatic grades creation."""
    print("\n=== Testing Cadet Creation ===")
    
    cadet = Cadet.objects.create(
        student_id="2024-001",
        first_name="John",
        last_name="Doe",
        company="Alpha",
        platoon="1st",
        course="BSCS",
        year_level=3
    )
    
    print(f"✓ Created cadet: {cadet.first_name} {cadet.last_name} (ID: {cadet.id})")
    
    # Check if grades were created automatically
    try:
        grades = Grades.objects.get(cadet=cadet)
        print(f"✓ Grades auto-created: ID {grades.id}")
    except Grades.DoesNotExist:
        print("✗ Grades NOT auto-created - need to add signal")
        # Create manually for now
        grades = Grades.objects.create(cadet=cadet)
        print(f"✓ Grades created manually: ID {grades.id}")
    
    return cadet, grades


def test_merit_demerit_system(cadet, user):
    """Test merit/demerit system with automatic grade updates."""
    print("\n=== Testing Merit/Demerit System ===")
    
    # Get initial grades
    grades = Grades.objects.get(cadet=cadet)
    initial_merit = grades.merit_points
    initial_demerit = grades.demerit_points
    
    print(f"Initial merit points: {initial_merit}")
    print(f"Initial demerit points: {initial_demerit}")
    
    # Add merit points
    merit_log = MeritDemeritLog.objects.create(
        cadet=cadet,
        type='merit',
        points=10,
        reason='Excellent performance',
        issued_by_user_id=user.id,
        issued_by_name=user.username
    )
    print(f"✓ Created merit log: +{merit_log.points} points")
    
    # Check if grades were updated
    grades.refresh_from_db()
    print(f"Merit points after signal: {grades.merit_points}")
    
    if grades.merit_points == initial_merit + 10:
        print("✓ Merit points updated automatically via signal")
    else:
        print(f"✗ Merit points NOT updated (expected {initial_merit + 10}, got {grades.merit_points})")
    
    # Add demerit points
    demerit_log = MeritDemeritLog.objects.create(
        cadet=cadet,
        type='demerit',
        points=5,
        reason='Late to training',
        issued_by_user_id=user.id,
        issued_by_name=user.username
    )
    print(f"✓ Created demerit log: +{demerit_log.points} points")
    
    # Check if grades were updated
    grades.refresh_from_db()
    print(f"Demerit points after signal: {grades.demerit_points}")
    
    if grades.demerit_points == initial_demerit + 5:
        print("✓ Demerit points updated automatically via signal")
    else:
        print(f"✗ Demerit points NOT updated (expected {initial_demerit + 5}, got {grades.demerit_points})")
    
    # Test deletion
    merit_log.delete()
    grades.refresh_from_db()
    print(f"Merit points after deletion: {grades.merit_points}")
    
    if grades.merit_points == initial_merit:
        print("✓ Merit points reverted after deletion via signal")
    else:
        print(f"✗ Merit points NOT reverted (expected {initial_merit}, got {grades.merit_points})")


def test_audit_logs():
    """Test audit log creation."""
    print("\n=== Testing Audit Logs ===")
    
    from apps.system.models import AuditLog
    
    audit_count = AuditLog.objects.count()
    print(f"Total audit logs created: {audit_count}")
    
    if audit_count > 0:
        print("✓ Audit logs are being created")
        latest = AuditLog.objects.latest('created_at')
        print(f"Latest: {latest.operation} on {latest.table_name}")
    else:
        print("✗ No audit logs found")


def test_sync_events():
    """Test sync event creation."""
    print("\n=== Testing Sync Events ===")
    
    from apps.system.models import SyncEvent
    
    event_count = SyncEvent.objects.count()
    print(f"Total sync events created: {event_count}")
    
    if event_count > 0:
        print("✓ Sync events are being created")
        latest = SyncEvent.objects.latest('created_at')
        print(f"Latest: {latest.event_type} (Processed: {latest.processed})")
    else:
        print("✗ No sync events found")


def cleanup():
    """Clean up test data."""
    print("\n=== Cleaning Up Test Data ===")
    
    User.objects.filter(username="testadmin").delete()
    Cadet.objects.filter(student_id="2024-001").delete()
    
    print("✓ Test data cleaned up")


if __name__ == "__main__":
    try:
        user = test_user_creation()
        cadet, grades = test_cadet_creation()
        test_merit_demerit_system(cadet, user)
        test_audit_logs()
        test_sync_events()
        
        print("\n" + "="*50)
        print("All tests completed!")
        print("="*50)
        
        # Cleanup
        cleanup()
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
