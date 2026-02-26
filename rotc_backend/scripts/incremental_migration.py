#!/usr/bin/env python3
"""
Incremental migration script for Django database.
Supports testing migration with subset of data and incremental data sync during transition.

Usage:
    # Test migration with 10% of data
    python incremental_migration.py --mode test --sample-size 0.1
    
    # Sync new/updated records since last sync
    python incremental_migration.py --mode sync --since "2024-01-01 00:00:00"
    
    # Sync specific tables only
    python incremental_migration.py --mode sync --tables users,cadets,grades
"""

import os
import sys
import json
import argparse
import logging
import random
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
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


class IncrementalMigrator:
    """Incremental migration handler."""
    
    def __init__(self, data_dir: str, mode: str = 'test', sample_size: float = 0.1, 
                 since: Optional[str] = None, tables: Optional[List[str]] = None):
        self.data_dir = data_dir
        self.mode = mode
        self.sample_size = sample_size
        self.since = parse_datetime(since) if since else None
        self.tables_filter = set(tables) if tables else None
        self.migration_stats = {}
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
    
    def sample_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sample a subset of data for testing."""
        if self.mode != 'test' or self.sample_size >= 1.0:
            return data
        
        sample_count = max(1, int(len(data) * self.sample_size))
        sampled = random.sample(data, sample_count)
        logger.info(f"Sampled {len(sampled)} records from {len(data)} total ({self.sample_size*100}%)")
        return sampled
    
    def filter_by_timestamp(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter data by timestamp for incremental sync."""
        if self.mode != 'sync' or not self.since:
            return data
        
        filtered = []
        for record in data:
            # Check created_at or updated_at timestamp
            created_at = record.get('created_at')
            updated_at = record.get('updated_at')
            
            if created_at:
                created_dt = parse_datetime(created_at)
                if created_dt and created_dt >= self.since:
                    filtered.append(record)
                    continue
            
            if updated_at:
                updated_dt = parse_datetime(updated_at)
                if updated_dt and updated_dt >= self.since:
                    filtered.append(record)
                    continue
        
        logger.info(f"Filtered {len(filtered)} records modified since {self.since}")
        return filtered
    
    def should_import_table(self, table_name: str) -> bool:
        """Check if table should be imported based on filter."""
        if not self.tables_filter:
            return True
        return table_name in self.tables_filter
    
    def prepare_record(self, model_class, record: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare record for import."""
        prepared = {}
        
        for field_name, value in record.items():
            if value is None:
                prepared[field_name] = None
                continue
            
            # Get field from model
            try:
                field = model_class._meta.get_field(field_name)
            except:
                # Skip fields not in model
                continue
            
            # Handle datetime fields
            if field.__class__.__name__ in ['DateTimeField']:
                if isinstance(value, str):
                    prepared[field_name] = parse_datetime(value)
                else:
                    prepared[field_name] = value
            
            # Handle date fields
            elif field.__class__.__name__ in ['DateField']:
                if isinstance(value, str):
                    prepared[field_name] = parse_date(value)
                else:
                    prepared[field_name] = value
            
            # Handle JSON fields
            elif field.__class__.__name__ in ['JSONField']:
                if isinstance(value, str):
                    try:
                        prepared[field_name] = json.loads(value)
                    except:
                        prepared[field_name] = value
                else:
                    prepared[field_name] = value
            
            else:
                prepared[field_name] = value
        
        return prepared
    
    def import_table(self, table_name: str, model_class) -> Dict[str, int]:
        """Import data for a single table."""
        if not self.should_import_table(table_name):
            logger.info(f"Skipping {table_name} (not in filter)")
            return {'skipped': 0}
        
        logger.info(f"Importing {table_name}...")
        
        # Load data
        data = self.load_json_data(table_name)
        if not data:
            return {'loaded': 0, 'imported': 0, 'updated': 0, 'errors': 0}
        
        # Apply sampling or filtering
        if self.mode == 'test':
            data = self.sample_data(data)
        elif self.mode == 'sync':
            data = self.filter_by_timestamp(data)
        
        if not data:
            logger.info(f"No records to import for {table_name}")
            return {'loaded': len(data), 'imported': 0, 'updated': 0, 'errors': 0}
        
        imported_count = 0
        updated_count = 0
        error_count = 0
        
        try:
            with transaction.atomic():
                for record in data:
                    try:
                        prepared = self.prepare_record(model_class, record)
                        record_id = prepared.get('id')
                        
                        if self.mode == 'sync' and record_id:
                            # Try to update existing record
                            try:
                                obj = model_class.objects.get(id=record_id)
                                for key, value in prepared.items():
                                    setattr(obj, key, value)
                                obj.save()
                                updated_count += 1
                            except model_class.DoesNotExist:
                                # Create new record
                                model_class.objects.create(**prepared)
                                imported_count += 1
                        else:
                            # Test mode - just create
                            model_class.objects.create(**prepared)
                            imported_count += 1
                    
                    except Exception as e:
                        error_count += 1
                        error_msg = f"Error importing record {record.get('id', 'unknown')} in {table_name}: {str(e)}"
                        logger.error(error_msg)
                        self.errors.append(error_msg)
                        
                        if error_count > 100:
                            logger.error(f"Too many errors in {table_name}, stopping import")
                            raise
            
            logger.info(f"Imported {imported_count} new, updated {updated_count} existing records in {table_name}")
            
        except Exception as e:
            logger.error(f"Transaction failed for {table_name}: {str(e)}")
            return {'loaded': len(data), 'imported': 0, 'updated': 0, 'errors': error_count}
        
        return {
            'loaded': len(data),
            'imported': imported_count,
            'updated': updated_count,
            'errors': error_count
        }
    
    def run(self) -> Dict[str, Any]:
        """Run incremental migration."""
        logger.info(f"Starting incremental migration in {self.mode} mode")
        logger.info(f"Data directory: {self.data_dir}")
        
        if self.mode == 'test':
            logger.info(f"Sample size: {self.sample_size*100}%")
        elif self.mode == 'sync':
            logger.info(f"Syncing records since: {self.since}")
        
        if self.tables_filter:
            logger.info(f"Tables filter: {', '.join(self.tables_filter)}")
        
        start_time = datetime.now()
        
        # Import tables in order
        for table_name, model_class in IMPORT_ORDER:
            stats = self.import_table(table_name, model_class)
            self.migration_stats[table_name] = stats
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Generate summary
        total_loaded = sum(s.get('loaded', 0) for s in self.migration_stats.values())
        total_imported = sum(s.get('imported', 0) for s in self.migration_stats.values())
        total_updated = sum(s.get('updated', 0) for s in self.migration_stats.values())
        total_errors = sum(s.get('errors', 0) for s in self.migration_stats.values())
        
        summary = {
            'mode': self.mode,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': duration,
            'total_loaded': total_loaded,
            'total_imported': total_imported,
            'total_updated': total_updated,
            'total_errors': total_errors,
            'tables': self.migration_stats,
            'errors': self.errors[:100]  # First 100 errors
        }
        
        logger.info(f"\nIncremental Migration Summary:")
        logger.info(f"Mode: {self.mode}")
        logger.info(f"Duration: {duration:.2f} seconds")
        logger.info(f"Total loaded: {total_loaded}")
        logger.info(f"Total imported: {total_imported}")
        logger.info(f"Total updated: {total_updated}")
        logger.info(f"Total errors: {total_errors}")
        
        # Save summary to file
        summary_path = os.path.join(
            self.data_dir,
            f"incremental_migration_summary_{self.mode}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, default=str)
        
        logger.info(f"Summary saved to: {summary_path}")
        
        return summary


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Incremental migration for Django database')
    parser.add_argument('--data-dir', default='./exports', help='Directory containing JSON export files')
    parser.add_argument('--mode', choices=['test', 'sync'], default='test', 
                       help='Migration mode: test (sample data) or sync (incremental)')
    parser.add_argument('--sample-size', type=float, default=0.1,
                       help='Sample size for test mode (0.0-1.0, default: 0.1)')
    parser.add_argument('--since', help='Sync records modified since this timestamp (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--tables', help='Comma-separated list of tables to import')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.mode == 'sync' and not args.since:
        parser.error("--since is required for sync mode")
    
    if args.sample_size < 0 or args.sample_size > 1:
        parser.error("--sample-size must be between 0.0 and 1.0")
    
    # Parse tables filter
    tables = args.tables.split(',') if args.tables else None
    
    # Run migration
    migrator = IncrementalMigrator(
        data_dir=args.data_dir,
        mode=args.mode,
        sample_size=args.sample_size,
        since=args.since,
        tables=tables
    )
    
    try:
        summary = migrator.run()
        
        if summary['total_errors'] > 0:
            logger.warning(f"Migration completed with {summary['total_errors']} errors")
            sys.exit(1)
        else:
            logger.info("Migration completed successfully")
            sys.exit(0)
    
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
