#!/usr/bin/env python3
"""
Migration verification script.
Verifies that data migration was successful by comparing source and target databases.

Usage:
    python verify_migration.py --source-db postgresql://user:pass@host:port/source_db --target-django
    python verify_migration.py --source-data ./exports --target-django
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime, date
from typing import Dict, List, Any, Optional, Tuple
import psycopg2
import psycopg2.extras
import sqlite3
from urllib.parse import urlparse

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

# Model mapping for verification
MODEL_MAPPING = {
    'users': User,
    'user_settings': UserSettings,
    'cadets': Cadet,
    'grades': Grades,
    'training_staff': TrainingStaff,
    'training_days': TrainingDay,
    'attendance_records': AttendanceRecord,
    'staff_attendance_records': StaffAttendanceRecord,
    'excuse_letters': ExcuseLetter,
    'merit_demerit_logs': MeritDemeritLog,
    'activities': Activity,
    'activity_images': ActivityImage,
    'admin_messages': AdminMessage,
    'staff_messages': StaffMessage,
    'notifications': Notification,
    'push_subscriptions': PushSubscription,
    'system_settings': SystemSettings,
    'audit_logs': AuditLog,
    'sync_events': SyncEvent,
}


class MigrationVerifier:
    """Migration verification utility."""
    
    def __init__(self, source_db_url: Optional[str] = None, source_data_dir: Optional[str] = None):
        self.source_db_url = source_db_url
        self.source_data_dir = source_data_dir
        self.source_connection = None
        self.verification_results = {}
        self.errors = []
        self.warnings = []
        
        if source_db_url:
            self.source_type = self._detect_db_type(source_db_url)
        else:
            self.source_type = 'json'
    
    def _detect_db_type(self, db_url: str) -> str:
        """Detect database type from URL."""
        parsed = urlparse(db_url)
        if parsed.scheme.startswith('postgresql'):
            return 'postgresql'
        elif parsed.scheme.startswith('sqlite'):
            return 'sqlite'
        else:
            raise ValueError(f"Unsupported database type: {parsed.scheme}")
    
    def connect_source_db(self):
        """Connect to source database."""
        if not self.source_db_url:
            return
        
        try:
            if self.source_type == 'postgresql':
                self.source_connection = psycopg2.connect(self.source_db_url)
                logger.info("Connected to source PostgreSQL database")
            elif self.source_type == 'sqlite':
                db_path = self.source_db_url.replace('sqlite:///', '')
                self.source_connection = sqlite3.connect(db_path)
                self.source_connection.row_factory = sqlite3.Row
                logger.info(f"Connected to source SQLite database: {db_path}")
        except Exception as e:
            logger.error(f"Failed to connect to source database: {e}")
            raise
    
    def disconnect_source_db(self):
        """Disconnect from source database."""
        if self.source_connection:
            self.source_connection.close()
            logger.info("Source database connection closed")
    
    def get_source_data(self, table_name: str) -> List[Dict[str, Any]]:
        """Get data from source (database or JSON files)."""
        if self.source_type == 'json':
            return self._load_json_data(table_name)
        else:
            return self._query_source_table(table_name)
    
    def _load_json_data(self, table_name: str) -> List[Dict[str, Any]]:
        """Load data from JSON file."""
        if not self.source_data_dir:
            return []
        
        json_path = os.path.join(self.source_data_dir, f"{table_name}.json")
        
        if not os.path.exists(json_path):
            logger.warning(f"Source data file not found: {json_path}")
            return []
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                logger.error(f"Invalid data format in {table_name}.json - expected list")
                return []
            
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {table_name}.json: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading {table_name}.json: {e}")
            return []
    
    def _query_source_table(self, table_name: str) -> List[Dict[str, Any]]:
        """Query data from source database table."""
        if not self.source_connection:
            return []
        
        try:
            cursor = self.source_connection.cursor()
            
            if self.source_type == 'postgresql':
                cursor = self.source_connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            cursor.execute(f"SELECT * FROM {table_name} ORDER BY id")
            
            if self.source_type == 'postgresql':
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]
            else:  # sqlite
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]
            
            cursor.close()
            return data
            
        except Exception as e:
            logger.error(f"Failed to query source table {table_name}: {e}")
            return []
    
    def get_django_data(self, table_name: str, model_class) -> List[Dict[str, Any]]:
        """Get data from Django model."""
        try:
            queryset = model_class.objects.all().order_by('id')
            data = []
            
            for obj in queryset:
                record = {}
                for field in obj._meta.fields:
                    value = getattr(obj, field.name)
                    
                    # Convert datetime objects to ISO strings for comparison
                    if isinstance(value, datetime):
                        record[field.name] = value.isoformat()
                    elif isinstance(value, date):
                        record[field.name] = value.isoformat()
                    else:
                        record[field.name] = value
                
                data.append(record)
            
            return data
            
        except Exception as e:
            logger.error(f"Failed to query Django model {model_class.__name__}: {e}")
            return []
    
    def normalize_value_for_comparison(self, value: Any, field_name: str) -> Any:
        """Normalize values for comparison."""
        if value is None:
            return None
        
        # Handle datetime fields
        if field_name.endswith('_at') or field_name == 'date_recorded':
            if isinstance(value, str):
                try:
                    # Parse and normalize timestamp
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    return dt.replace(tzinfo=None).isoformat()
                except ValueError:
                    return value
            elif isinstance(value, datetime):
                return value.replace(tzinfo=None).isoformat()
        
        # Handle date fields
        elif field_name in ['date', 'birthdate', 'date_absent']:
            if isinstance(value, str):
                if 'T' in value:
                    return value.split('T')[0]
                return value
            elif isinstance(value, date):
                return value.isoformat()
        
        # Handle boolean fields
        elif isinstance(value, bool):
            return value
        
        # Handle numeric fields
        elif isinstance(value, (int, float)):
            return value
        
        # Handle string fields
        elif isinstance(value, str):
            return value.strip() if value else value
        
        return value
    
    def compare_records(self, source_record: Dict[str, Any], django_record: Dict[str, Any], table_name: str) -> Tuple[bool, List[str]]:
        """Compare source and Django records."""
        differences = []
        
        # Compare each field
        for field_name, source_value in source_record.items():
            if field_name not in django_record:
                differences.append(f"Field '{field_name}' missing in Django record")
                continue
            
            django_value = django_record[field_name]
            
            # Normalize values for comparison
            normalized_source = self.normalize_value_for_comparison(source_value, field_name)
            normalized_django = self.normalize_value_for_comparison(django_value, field_name)
            
            # Compare normalized values
            if normalized_source != normalized_django:
                # Special handling for floating point numbers
                if isinstance(normalized_source, (int, float)) and isinstance(normalized_django, (int, float)):
                    if abs(float(normalized_source) - float(normalized_django)) < 0.001:
                        continue  # Close enough for floating point
                
                differences.append(
                    f"Field '{field_name}': source='{normalized_source}' != django='{normalized_django}'"
                )
        
        return len(differences) == 0, differences
    
    def verify_table(self, table_name: str) -> Dict[str, Any]:
        """Verify a single table migration."""
        logger.info(f"Verifying table: {table_name}")
        
        model_class = MODEL_MAPPING.get(table_name)
        if not model_class:
            logger.warning(f"No Django model found for table {table_name}")
            return {
                'table_name': table_name,
                'status': 'skipped',
                'reason': 'No Django model mapping'
            }
        
        # Get source and Django data
        source_data = self.get_source_data(table_name)
        django_data = self.get_django_data(table_name, model_class)
        
        result = {
            'table_name': table_name,
            'source_count': len(source_data),
            'django_count': len(django_data),
            'status': 'unknown',
            'matched_records': 0,
            'missing_records': 0,
            'extra_records': 0,
            'mismatched_records': 0,
            'errors': [],
            'warnings': []
        }
        
        if not source_data and not django_data:
            result['status'] = 'empty'
            logger.info(f"✓ Table {table_name} is empty in both source and Django")
            return result
        
        if not source_data:
            result['status'] = 'source_empty'
            result['warnings'].append("Source data is empty but Django has records")
            logger.warning(f"⚠ Table {table_name}: Source is empty but Django has {len(django_data)} records")
            return result
        
        if not django_data:
            result['status'] = 'django_empty'
            result['errors'].append("Django data is empty but source has records")
            logger.error(f"✗ Table {table_name}: Django is empty but source has {len(source_data)} records")
            return result
        
        # Create lookup dictionaries by ID
        source_by_id = {record['id']: record for record in source_data if 'id' in record}
        django_by_id = {record['id']: record for record in django_data if 'id' in record}
        
        # Check for missing records in Django
        for source_id, source_record in source_by_id.items():
            if source_id not in django_by_id:
                result['missing_records'] += 1
                result['errors'].append(f"Record with ID {source_id} missing in Django")
            else:
                # Compare records
                django_record = django_by_id[source_id]
                is_match, differences = self.compare_records(source_record, django_record, table_name)
                
                if is_match:
                    result['matched_records'] += 1
                else:
                    result['mismatched_records'] += 1
                    result['errors'].append(f"Record ID {source_id} has differences: {'; '.join(differences)}")
        
        # Check for extra records in Django
        for django_id in django_by_id:
            if django_id not in source_by_id:
                result['extra_records'] += 1
                result['warnings'].append(f"Extra record with ID {django_id} found in Django")
        
        # Determine overall status
        if result['missing_records'] > 0 or result['mismatched_records'] > 0:
            result['status'] = 'failed'
            logger.error(f"✗ Table {table_name} verification failed")
        elif result['extra_records'] > 0:
            result['status'] = 'warning'
            logger.warning(f"⚠ Table {table_name} verification passed with warnings")
        else:
            result['status'] = 'passed'
            logger.info(f"✓ Table {table_name} verification passed")
        
        return result
    
    def verify_all_tables(self) -> Dict[str, Any]:
        """Verify all table migrations."""
        logger.info("Starting migration verification...")
        
        overall_result = {
            'verification_timestamp': datetime.now().isoformat(),
            'source_type': self.source_type,
            'tables': {},
            'summary': {
                'total_tables': 0,
                'passed': 0,
                'failed': 0,
                'warnings': 0,
                'skipped': 0,
                'empty': 0
            }
        }
        
        for table_name in MODEL_MAPPING.keys():
            try:
                result = self.verify_table(table_name)
                overall_result['tables'][table_name] = result
                overall_result['summary']['total_tables'] += 1
                
                if result['status'] == 'passed':
                    overall_result['summary']['passed'] += 1
                elif result['status'] == 'failed':
                    overall_result['summary']['failed'] += 1
                elif result['status'] == 'warning':
                    overall_result['summary']['warnings'] += 1
                elif result['status'] == 'skipped':
                    overall_result['summary']['skipped'] += 1
                elif result['status'] == 'empty':
                    overall_result['summary']['empty'] += 1
                
            except Exception as e:
                logger.error(f"Error verifying table {table_name}: {e}")
                overall_result['tables'][table_name] = {
                    'table_name': table_name,
                    'status': 'error',
                    'error': str(e)
                }
                overall_result['summary']['failed'] += 1
        
        return overall_result
    
    def print_verification_summary(self, results: Dict[str, Any]):
        """Print verification summary."""
        logger.info("\n" + "="*70)
        logger.info("MIGRATION VERIFICATION SUMMARY")
        logger.info("="*70)
        
        summary = results['summary']
        logger.info(f"Total tables verified: {summary['total_tables']}")
        logger.info(f"✓ Passed: {summary['passed']}")
        logger.info(f"✗ Failed: {summary['failed']}")
        logger.info(f"⚠ Warnings: {summary['warnings']}")
        logger.info(f"- Skipped: {summary['skipped']}")
        logger.info(f"∅ Empty: {summary['empty']}")
        
        # Detailed results
        logger.info("\nDetailed Results:")
        logger.info("-" * 70)
        
        for table_name, result in results['tables'].items():
            status_symbol = {
                'passed': '✓',
                'failed': '✗',
                'warning': '⚠',
                'skipped': '-',
                'empty': '∅',
                'error': '!',
                'source_empty': '?',
                'django_empty': '?'
            }.get(result['status'], '?')
            
            logger.info(f"{status_symbol} {table_name:25} | Status: {result['status']}")
            
            if 'source_count' in result and 'django_count' in result:
                logger.info(f"  {'':25} | Source: {result['source_count']:4} | Django: {result['django_count']:4}")
            
            if 'matched_records' in result:
                logger.info(f"  {'':25} | Matched: {result['matched_records']:3} | Missing: {result['missing_records']:3} | Extra: {result['extra_records']:3} | Mismatched: {result['mismatched_records']:3}")
            
            # Show first few errors/warnings
            if result.get('errors'):
                for error in result['errors'][:3]:
                    logger.error(f"    ERROR: {error}")
                if len(result['errors']) > 3:
                    logger.error(f"    ... and {len(result['errors']) - 3} more errors")
            
            if result.get('warnings'):
                for warning in result['warnings'][:2]:
                    logger.warning(f"    WARNING: {warning}")
                if len(result['warnings']) > 2:
                    logger.warning(f"    ... and {len(result['warnings']) - 2} more warnings")
        
        # Overall status
        logger.info("\n" + "="*70)
        if summary['failed'] == 0:
            if summary['warnings'] == 0:
                logger.info("🎉 MIGRATION VERIFICATION PASSED - All data migrated successfully!")
            else:
                logger.warning("⚠ MIGRATION VERIFICATION PASSED WITH WARNINGS")
        else:
            logger.error("❌ MIGRATION VERIFICATION FAILED - Data migration has errors!")
        
        return summary['failed'] == 0
    
    def save_verification_report(self, results: Dict[str, Any], output_path: str):
        """Save verification report to JSON file."""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, default=str)
            
            logger.info(f"Verification report saved to: {output_path}")
            
        except Exception as e:
            logger.error(f"Failed to save verification report: {e}")


def main():
    """Main verification function."""
    parser = argparse.ArgumentParser(description='Verify data migration success')
    parser.add_argument('--source-db', help='Source database connection URL')
    parser.add_argument('--source-data', help='Directory containing source JSON export files')
    parser.add_argument('--report', help='Output path for verification report JSON file')
    
    args = parser.parse_args()
    
    if not args.source_db and not args.source_data:
        logger.error("Either --source-db or --source-data must be provided")
        sys.exit(1)
    
    # Initialize verifier
    verifier = MigrationVerifier(args.source_db, args.source_data)
    
    try:
        # Connect to source database if needed
        if args.source_db:
            verifier.connect_source_db()
        
        # Run verification
        results = verifier.verify_all_tables()
        
        # Print summary
        success = verifier.print_verification_summary(results)
        
        # Save report if requested
        if args.report:
            verifier.save_verification_report(results, args.report)
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        sys.exit(1)
    
    finally:
        if args.source_db:
            verifier.disconnect_source_db()


if __name__ == '__main__':
    main()