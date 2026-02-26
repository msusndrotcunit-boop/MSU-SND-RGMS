"""
Quick test for Task 20: System settings and user preferences API
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.system.models import SystemSettings
from apps.authentication.models import User, UserSettings
from apps.system.serializers import SystemSettingsSerializer, UserSettingsSerializer

def test_system_settings():
    """Test system settings functionality."""
    print("\n=== Testing System Settings ===")
    
    # Check default settings exist
    settings = SystemSettings.objects.all()
    print(f"✓ Found {settings.count()} default system settings")
    
    for setting in settings:
        print(f"  - {setting.key}: {setting.value}")
    
    # Test serializer validation
    serializer = SystemSettingsSerializer(data={'key': 'test_key', 'value': 'test_value'})
    if serializer.is_valid():
        print("✓ SystemSettingsSerializer validation works")
    else:
        print(f"✗ Serializer validation failed: {serializer.errors}")
    
    # Test semester validation
    serializer = SystemSettingsSerializer(data={'key': 'semester', 'value': '1st'})
    if serializer.is_valid():
        print("✓ Semester validation works (valid value)")
    else:
        print(f"✗ Semester validation failed: {serializer.errors}")
    
    serializer = SystemSettingsSerializer(data={'key': 'semester', 'value': 'invalid'})
    if not serializer.is_valid():
        print("✓ Semester validation works (invalid value rejected)")
    else:
        print("✗ Semester validation should have failed")

def test_user_settings():
    """Test user settings functionality."""
    print("\n=== Testing User Settings ===")
    
    # Create a test user
    test_user = User.objects.filter(username='test_user_task20').first()
    if not test_user:
        test_user = User.objects.create(
            username='test_user_task20',
            email='test_task20@example.com',
            password='test_password',
            role='cadet',
            is_approved=True
        )
        print("✓ Created test user")
    else:
        print("✓ Using existing test user")
    
    # Check if UserSettings was auto-created
    user_settings = UserSettings.objects.filter(user=test_user).first()
    if user_settings:
        print("✓ UserSettings auto-created via signal")
        print(f"  - email_alerts: {user_settings.email_alerts}")
        print(f"  - dark_mode: {user_settings.dark_mode}")
        print(f"  - primary_color: {user_settings.primary_color}")
    else:
        print("✗ UserSettings not auto-created")
    
    # Test serializer validation
    serializer = UserSettingsSerializer(data={
        'email_alerts': True,
        'dark_mode': False,
        'primary_color': 'blue'
    })
    if serializer.is_valid():
        print("✓ UserSettingsSerializer validation works")
    else:
        print(f"✗ Serializer validation failed: {serializer.errors}")
    
    # Test primary_color validation
    serializer = UserSettingsSerializer(data={'primary_color': 'blue'})
    if serializer.is_valid():
        print("✓ Primary color validation works (valid color)")
    else:
        print(f"✗ Primary color validation failed: {serializer.errors}")
    
    serializer = UserSettingsSerializer(data={'primary_color': 'invalid_color'})
    if not serializer.is_valid():
        print("✓ Primary color validation works (invalid color rejected)")
    else:
        print("✗ Primary color validation should have failed")

if __name__ == '__main__':
    print("Testing Task 20 Implementation")
    print("=" * 50)
    
    test_system_settings()
    test_user_settings()
    
    print("\n" + "=" * 50)
    print("Task 20 tests completed!")
