#!/usr/bin/env python3
"""
Data import script for Django database.
Imports JSON data from Node.js export into Django models.

Usage:
    python manage.py shell < import_django_data.py
    python import_django_data.py --data-dir ./exports --batch-size 1000
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from django.db import transaction, connection
from django.core.exceptions import ValidationError
from django.utils.dateparse import parse_datetime, parse_date

# Add Django project to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

# Import Django models
from apps.authentication.models import User, UserSettings
from apps.cadets.models import Cadet, Grades
from apps.grading.models import MeritDemeritLog
from apps.staff.models import TrainingStaff
from apps.attendance.models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter
from apps.activities.models import Activity, ActivityImage
from apps.messaging.models import AdminMessage, StaffMessage, Notification, PushSubscription
from apps.system.models import SystemSettings, AuditLog, SyncEvent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import order based on foreign key dependencies
IMPORT_ORDER = [
    ('users', User),
    ('user_settings', UserSettings),
    ('cadets', Cadet),
    ('grades', Grades),
    ('training_staff', TrainingStaff),
    ('training_days', TrainingDay),
    ('attendance_records', AttendanceRecord),
    ('staff_attendance_records', StaffAttendanceRecord),
    ('excuse_letters', ExcuseLetter),
    ('merit_demerit_logs', MeritDemeritLog),
    ('activities', Activity),
    ('activity_images', ActivityImage),
    ('admin_messages', AdminMessage),
    ('staff_messages', StaffMessage),
    ('notifications', Notification),
    ('push_subscriptions', PushSubscription),
    ('system_settings', SystemSettings),
    ('audit_logs', AuditLog),
    ('sync_events', SyncEvent),
]


class DataImporter:
    """Data importer for Django models."""
    
    def __init__(self, data_dir: str, batch_size: int = 1000):
        self.data_dir = data_dir
        self.batch_size = batch_size
        self.import_stats = {}
        self.errors = []
        
    def load_json_data(self, table_name: str) -> List[Dict[str, Any]]:
        """Load data from JSON file."""
        json_path = os.path.join(self.data_dir, f"{table_name}.json")
        
        if not os.path.exists(json_path):
            logger.warning(f"Data file not found: {json_path}")
            return []
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                logger.error(f"Invalid data format in {table_name}.json - expected list")
                return []
            
            logger.info(f"Loaded {len(data)} records from {table_name}.json")
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {table_name}.json: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading {table_name}.json: {e}")
            return []
    
    def parse_datetime_field(self, value: Any) -> Optional[datetime]:
        """Parse datetime field from various formats."""
        if value is None:
            return None
        
        if isinstance(value, str):
            # Try parsing ISO format
            parsed = parse_datetime(value)
            if parsed:
                return parsed
            
            # Try parsing without timezone
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                pass
        
        logger.warning(f"Could not parse datetime: {value}")
        return None
    
    def parse_date_field(self, value: Any) -> Optional[datetime.date]:
        """Parse date field from various formats."""
        if value is None:
            return None
        
        if isinstance(value, str):
            parsed = parse_date(value)
            if parsed:
                return parsed
        
        logger.warning(f"Could not parse date: {value}")
        return None
    
    def import_users(self, data: List[Dict[str, Any]]) -> int:
        """Import users data."""
        logger.info("Importing users...")
        
        imported_count = 0
        batch = []
        
        for record in data:
            try:
                user = User(
                    id=record['id'],
                    username=record['username'],
                    email=record['email'],
                    password=record['password'],  # bcrypt hash preserved
                    role=record['role'],
                    is_approved=record.get('is_approved', False),
                    cadet_id=record.get('cadet_id'),
                    staff_id=record.get('staff_id'),
                    profile_pic=record.get('profile_pic'),
                    last_latitude=record.get('last_latitude'),
                    last_longitude=record.get('last_longitude'),
                    last_location_at=self.parse_datetime_field(record.get('last_location_at')),
                    created_at=self.parse_datetime_field(record['created_at'])
                )
                
                batch.append(user)
                
                if len(batch) >= self.batch_size:
                    User.objects.bulk_create(batch, ignore_conflicts=True)
                    imported_count += len(batch)
                    batch = []
                    
            except Exception as e:
                self.errors.append(f"Error importing user {record.get('id', 'unknown')}: {e}")
                logger.error(f"Error importing user {record.get('id', 'unknown')}: {e}")
        
        # Import remaining batch
        if batch:
            User.objects.bulk_create(batch, ignore_conflicts=True)
            imported_count += len(batch)
        
        return imported_count
    
    def import_user_settings(self, data: List[Dict[str, Any]]) -> int:
        """Import user settings data."""
        logger.info("Importing user settings...")
        
        imported_count = 0
        batch = []
        
        for record in data:
            try:
                user_settings = UserSettings(
                    id=record['id'],
                    user_id=record['user_id'],
                    email_alerts=record.get('email_alerts', True),
                    push_notifications=record.get('push_notifications', True),
                    activity_updates=record.get('activity_updates', True),
                    dark_mode=record.get('dark_mode', False),
                    compact_mode=record.get('compact_mode', False),
                    primary_color=record.get('primary_color', 'blue'),
                    custom_bg=record.get('custom_bg')
                )
                
                batch.append(user_settings)
                
                if len(batch) >= self.batch_size:
                    UserSettings.objects.bulk_create(batch, ignore_conflicts=True)
                    imported_count += len(batch)
                    batch = []
                    
            except Exception as e:
                self.errors.append(f"Error importing user settings {record.get('id', 'unknown')}: {e}")
                logger.error(f"Error importing user settings {record.get('id', 'unknown')}: {e}")
        
        # Import remaining batch
        if batch:
            UserSettings.objects.bulk_create(batch, ignore_conflicts=True)
            imported_count += len(batch)
        
        return imported_count
    
    def import_cadets(self, data: List[Dict[str, Any]]) -> int:
        """Import cadets data."""
        logger.info("Importing cadets...")
        
        imported_count = 0
        batch = []
        
        for record in data:
            try:
                cadet = Cadet(
                    id=record['id'],
                    student_id=record['student_id'],
                    first_name=record['first_name'],
                    last_name=record['last_name'],
                    middle_name=record.get('middle_name'),
                    suffix_name=record.get('suffix_name'),
                    company=record.get('company'),
                    platoon=record.get('platoon'),
                    course=record.get('course'),
                    year_level=record.get('year_level'),
                    status=record.get('status', 'Ongoing'),
                    profile_pic=record.get('profile_pic'),
                    contact_number=record.get('contact_number'),
                    email=record.get('email'),
                    birthdate=self.parse_date_field(record.get('birthdate')),
                    birthplace=record.get('birthplace'),
                    age=record.get('age'),
                    height=record.get('height'),
                    weight=record.get('weight'),
                    blood_type=record.get('blood_type'),
                    address=record.get('address'),
                    civil_status=record.get('civil_status'),
                    nationality=record.get('nationality'),
                    gender=record.get('gender'),
                    language_spoken=record.get('language_spoken'),
                    combat_boots_size=record.get('combat_boots_size'),
                    uniform_size=record.get('uniform_size'),
                    bullcap_size=record.get('bullcap_size'),
                    facebook_link=record.get('facebook_link'),
                    rotc_unit=record.get('rotc_unit'),
                    mobilization_center=record.get('mobilization_center'),
                    is_profile_completed=record.get('is_profile_completed', False),
                    is_archived=record.get('is_archived', False),
                    created_at=self.parse_datetime_field(record['created_at'])
                )
                
                batch.append(cadet)
                
                if len(batch) >= self.batch_size:
                    Cadet.objects.bulk_create(batch, ignore_conflicts=True)
                    imported_count += len(batch)
                    batch = []
                    
            except Exception as e:
                self.errors.append(f"Error importing cadet {record.get('id', 'unknown')}: {e}")
                logger.error(f"Error importing cadet {record.get('id', 'unknown')}: {e}")
        
        # Import remaining batch
        if batch:
            Cadet.objects.bulk_create(batch, ignore_conflicts=True)
            imported_count += len(batch)
        
        return imported_count
    
    def import_grades(self, data: List[Dict[str, Any]]) -> int:
        """Import grades data."""
        logger.info("Importing grades...")
        
        imported_count = 0
        batch = []
        
        for record in data:
            try:
                grades = Grades(
                    id=record['id'],
                    cadet_id=record['cadet_id'],
                    attendance_present=record.get('attendance_present', 0),
                    merit_points=record.get('merit_points', 0),
                    demerit_points=record.get('demerit_points', 0),
                    prelim_score=record.get('prelim_score'),
                    midterm_score=record.get('midterm_score'),
                    final_score=record.get('final_score')
                )
                
                batch.append(grades)
                
                if len(batch) >= self.batch_size:
                    Grades.objects.bulk_create(batch, ignore_conflicts=True)
                    imported_count += len(batch)
                    batch = []
                    
            except Exception as e:
                self.errors.append(f"Error importing grades {record.get('id', 'unknown')}: {e}")
                logger.error(f"Error importing grades {record.get('id', 'unknown')}: {e}")
        
        # Import remaining batch
        if batch:
            Grades.objects.bulk_create(batch, ignore_conflicts=True)
            imported_count += len(batch)
        
        return imported_count
    
    def import_training_staff(self, data: List[Dict[str, Any]]) -> int:
        """Import training staff data."""
        logger.info("Importing training staff...")
        
        imported_count = 0
        batch = []
        
        for record in data:
            try:
                staff = TrainingStaff(
                    id=record['id'],
                    first_name=record['first_name'],
                    last_name=record['last_name'],
                    middle_name=record.get('middle_name'),
                    suffix_name=record.get('suffix_name'),
                    rank=record.get('rank'),
                    email=record['email'],
                    contact_number=record.get('contact_number'),
                    role=record.get('role'),
                    profile_pic=record.get('profile_pic'),
                    afpsn=record.get('afpsn'),
                    birthdate=self.parse_date_field(record.get('birthdate')),
                    birthplace=record.get('birthplace'),
                    age=record.get('age'),
                    height=record.get('height'),
                    weight=record.get('weight'),
                    blood_type=record.get('blood_type'),
                    address=record.get('address'),
                    civil_status=record.get('civil_status'),
                    nationality=record.get('nationality'),
                    gender=record.get('gender'),
                    language_spoken=record.get('language_spoken'),
                    combat_boots_size=record.get('combat_boots_size'),
                    uniform_size=record.get('uniform_size'),
                    bullcap_size=record.get('bullcap_size'),
                    facebook_link=record.get('facebook_link'),
                    rotc_unit=record.get('rotc_unit'),
                    mobilization_center=record.get('mobilization_center'),
                    is_profile_completed=record.get('is_profile_completed', False),
                    has_seen_guide=record.get('has_seen_guide', False),
                    is_archived=record.get('is_archived', False),
                    created_at=self.parse_datetime_field(record['created_at'])
                )
                
                batch.append(staff)
                
                if len(batch) >= self.batch_size:
                    TrainingStaff.objects.bulk_create(batch, ignore_conflicts=True)
                    imported_count += len(batch)
                    batch = []
                    
            except Exception as e:
                self.errors.append(f"Error importing training staff {record.get('id', 'unknown')}: {e}")
                logger.error(f"Error importing training staff {record.get('id', 'unknown')}: {e}")
        
        # Import remaining batch
        if batch:
            TrainingStaff.objects.bulk_create(batch, ignore_conflicts=True)
            imported_count += len(batch)
        
        return imported_count
    
    def import_generic_model(self, table_name: str, model_class, data: List[Dict[str, Any]]) -> int:
        """Generic import method for simpler models."""
        logger.info(f"Importing {table_name}...")
        
        imported_count = 0
        batch = []
        
        for record in data:
            try:
                # Create model instance with all fields from record
                model_data = {}
                
                for field_name, value in record.items():
                    # Handle datetime fields
                    if field_name.endswith('_at') or field_name == 'date_recorded':
                        model_data[field_name] = self.parse_datetime_field(value)
                    # Handle date fields
                    elif field_name in ['date', 'birthdate', 'date_absent']:
                        model_data[field_name] = self.parse_date_field(value)
                    else:
                        model_data[field_name] = value
                
                instance = model_class(**model_data)
                batch.append(instance)
                
                if len(batch) >= self.batch_size:
                    model_class.objects.bulk_create(batch, ignore_conflicts=True)
                    imported_count += len(batch)
                    batch = []
                    
            except Exception as e:
                self.errors.append(f"Error importing {table_name} {record.get('id', 'unknown')}: {e}")
                logger.error(f"Error importing {table_name} {record.get('id', 'unknown')}: {e}")
        
        # Import remaining batch
        if batch:
            model_class.objects.bulk_create(batch, ignore_conflicts=True)
            imported_count += len(batch)
        
        return imported_count
    
    def reset_sequences(self):
        """Reset database sequences for auto-increment fields."""
        logger.info("Resetting database sequences...")
        
        with connection.cursor() as cursor:
            # Get all tables with auto-increment fields
            tables = [
                'users', 'user_settings', 'cadets', 'grades', 'training_staff',
                'training_days', 'attendance_records', 'staff_attendance_records',
                'excuse_letters', 'merit_demerit_logs', 'activities', 'activity_images',
                'admin_messages', 'staff_messages', 'notifications', 'push_subscriptions',
                'system_settings', 'audit_logs', 'sync_events'
            ]
            
            for table in tables:
                try:
                    # PostgreSQL sequence reset
                    cursor.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table};")
                    logger.info(f"Reset sequence for {table}")
                except Exception as e:
                    logger.warning(f"Could not reset sequence for {table}: {e}")
    
    def import_all_data(self) -> Dict[str, int]:
        """Import all data in correct order."""
        logger.info("Starting data import...")
        
        # Custom import methods for complex models
        custom_importers = {
            'users': self.import_users,
            'user_settings': self.import_user_settings,
            'cadets': self.import_cadets,
            'grades': self.import_grades,
            'training_staff': self.import_training_staff,
        }
        
        with transaction.atomic():
            for table_name, model_class in IMPORT_ORDER:
                logger.info(f"\n--- Importing {table_name} ---")
                
                data = self.load_json_data(table_name)
                if not data:
                    logger.info(f"No data to import for {table_name}")
                    self.import_stats[table_name] = 0
                    continue
                
                try:
                    if table_name in custom_importers:
                        imported_count = custom_importers[table_name](data)
                    else:
                        imported_count = self.import_generic_model(table_name, model_class, data)
                    
                    self.import_stats[table_name] = imported_count
                    logger.info(f"✓ Imported {imported_count} records for {table_name}")
                    
                except Exception as e:
                    logger.error(f"✗ Failed to import {table_name}: {e}")
                    self.import_stats[table_name] = 0
                    raise
        
        # Reset sequences after import
        self.reset_sequences()
        
        return self.import_stats
    
    def print_import_summary(self):
        """Print import summary."""
        logger.info("\n" + "="*50)
        logger.info("IMPORT SUMMARY")
        logger.info("="*50)
        
        total_imported = 0
        for table_name, count in self.import_stats.items():
            logger.info(f"{table_name:25}: {count:6} records")
            total_imported += count
        
        logger.info("-"*50)
        logger.info(f"{'TOTAL':25}: {total_imported:6} records")
        
        if self.errors:
            logger.error(f"\nErrors encountered: {len(self.errors)}")
            for error in self.errors[:10]:  # Show first 10 errors
                logger.error(f"  - {error}")
            if len(self.errors) > 10:
                logger.error(f"  ... and {len(self.errors) - 10} more errors")
        else:
            logger.info("\n✓ Import completed successfully with no errors")


def main():
    """Main import function."""
    parser = argparse.ArgumentParser(description='Import JSON data to Django database')
    parser.add_argument('--data-dir', required=True, help='Directory containing JSON export files')
    parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for bulk operations')
    parser.add_argument('--dry-run', action='store_true', help='Perform dry run without actual import')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.data_dir):
        logger.error(f"Data directory does not exist: {args.data_dir}")
        sys.exit(1)
    
    # Initialize importer
    importer = DataImporter(args.data_dir, args.batch_size)
    
    if args.dry_run:
        logger.info("DRY RUN MODE - No data will be imported")
        # Just load and validate data
        for table_name, _ in IMPORT_ORDER:
            data = importer.load_json_data(table_name)
            logger.info(f"{table_name}: {len(data)} records ready for import")
        return
    
    try:
        # Import all data
        importer.import_all_data()
        
        # Print summary
        importer.print_import_summary()
        
        logger.info("Data import completed successfully")
        
    except Exception as e:
        logger.error(f"Import failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()