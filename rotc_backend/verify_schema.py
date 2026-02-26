import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.db import connection

def get_table_info(table_name):
    cursor = connection.cursor()
    cursor.execute(f"PRAGMA table_info({table_name});")
    return cursor.fetchall()

def get_indexes(table_name):
    cursor = connection.cursor()
    cursor.execute(f"PRAGMA index_list({table_name});")
    return cursor.fetchall()

# Verify key tables
tables_to_check = ['users', 'cadets', 'grades', 'attendance_records', 'training_staff']

print("Schema Verification")
print("=" * 70)

for table in tables_to_check:
    print(f"\n{table.upper()}")
    print("-" * 70)
    
    # Get columns
    columns = get_table_info(table)
    print(f"Columns ({len(columns)}):")
    for col in columns[:5]:  # Show first 5 columns
        print(f"  - {col[1]} ({col[2]})")
    if len(columns) > 5:
        print(f"  ... and {len(columns) - 5} more columns")
    
    # Get indexes
    indexes = get_indexes(table)
    print(f"\nIndexes ({len(indexes)}):")
    for idx in indexes:
        print(f"  - {idx[1]}")

print("\n" + "=" * 70)
print("✓ Schema verification complete!")
