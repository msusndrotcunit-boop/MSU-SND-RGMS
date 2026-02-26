import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.db import connection

cursor = connection.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = [row[0] for row in cursor.fetchall()]

print("Database Tables:")
print("=" * 50)
for table in tables:
    print(f"  - {table}")

print("\n" + "=" * 50)
print(f"Total tables: {len(tables)}")

# Check for our expected tables
expected_tables = [
    'users', 'user_settings', 'cadets', 'grades', 'merit_demerit_logs',
    'training_days', 'attendance_records', 'staff_attendance_records', 'excuse_letters',
    'activities', 'activity_images', 'training_staff',
    'admin_messages', 'staff_messages', 'notifications', 'push_subscriptions',
    'system_settings', 'audit_logs', 'sync_events'
]

print("\nExpected ROTC tables verification:")
print("=" * 50)
for table in expected_tables:
    status = "✓" if table in tables else "✗"
    print(f"  {status} {table}")
