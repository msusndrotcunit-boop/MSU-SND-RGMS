#!/usr/bin/env python3
"""
Data validation script for migration data.
Validates exported JSON data before importing to Django database.

Usage:
    python validate_migration_data.py --data-dir ./exports
    python validate_migration_data.py --data-dir ./exports --strict
"""

import os
import sys
import json
import argparse
import logging
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Expected tables and their required fields
TABLE_SCHEMAS = {
    'users': {
        'required_fields': ['id', 'username', 'email', 'password', 'role', 'is_approved', 'created_at'],
        'unique_fields': ['username', 'email'],
        'enum_fields': {
            'role': ['admin', 'cadet', 'training_staff']
        },
        'foreign_keys': {
            'cadet_id': 'cadets',
            'staff_id': 'training_staff'
        }
    },
    'user_settings': {
        'required_fields': ['id', 'user_id'],
        'foreign_keys': {
            'user_id': 'users'
        }
    },
    'cadets': {
        'required_fields': ['id', 'student_id', 'first_name', 'last_name', 'is_archived', 'created_at'],
        'unique_fields': ['student_id'],
        'enum_fields': {
            'status': ['Ongoing', 'Graduated', 'Dropped', 'Transferred']
        }
    },
    'grades': {
        'required_fields': ['id', 'cadet_id', 'attendance_present', 'merit_points', 'demerit_points'],
        'foreign_keys': {
            'cadet_id': 'cadets'
        }
    },
    'training_staff': {
        'required_fields': ['id', 'first_name', 'last_name', 'email', 'is_archived', 'created_at'],
        'unique_fields': ['email']
    },
    'training_days': {
        'required_fields': ['id', 'date', 'title', 'created_at']
    },
    'attendance_records': {
        'required_fields': ['id', 'training_day_id', 'cadet_id', 'status', 'created_at'],
        'enum_fields': {
            'status': ['present', 'absent', 'late', 'excused']
        },
        'foreign_keys': {
            'training_day_id': 'training_days',
            'cadet_id': 'cadets'
        },
        'unique_together': [['training_day_id', 'cadet_id']]
    },
    'staff_attendance_records': {
        'required_fields': ['id', 'training_day_id', 'staff_id', 'created_at'],
        'foreign_keys': {
            'training_day_id': 'training_days',
            'staff_id': 'training_staff'
        },
        'unique_together': [['training_day_id', 'staff_id']]
    },
    'excuse_letters': {
        'required_fields': ['id', 'cadet_id', 'date_absent', 'reason', 'status', 'created_at'],
        'enum_fields': {
            'status': ['pending', 'approved', 'rejected']
        },
        'foreign_keys': {
            'cadet_id': 'cadets',
            'training_day_id': 'training_days'
        }
    },
    'merit_demerit_logs': {
        'required_fields': ['id', 'cadet_id', 'type', 'points', 'reason', 'issued_by_user_id', 'issued_by_name', 'date_recorded'],
        'enum_fields': {
            'type': ['merit', 'demerit']
        },
        'foreign_keys': {
            'cadet_id': 'cadets'
        }
    },
    'activities': {
        'required_fields': ['id', 'title', 'description', 'date', 'created_at'],
        'enum_fields': {
            'type': ['activity', 'achievement', 'event']
        }
    },
    'activity_images': {
        'required_fields': ['id', 'activity_id', 'image_url', 'created_at'],
        'foreign_keys': {
            'activity_id': 'activities'
        }
    },
    'admin_messages': {
        'required_fields': ['id', 'user_id', 'subject', 'message', 'status', 'created_at'],
        'enum_fields': {
            'status': ['pending', 'replied']
        },
        'foreign_keys': {
            'user_id': 'users'
        }
    },
    'staff_messages': {
        'required_fields': ['id', 'sender_staff_id', 'content', 'created_at'],
        'foreign_keys': {
            'sender_staff_id': 'training_staff'
        }
    },
    'notifications': {
        'required_fields': ['id', 'user_id', 'message', 'type', 'is_read', 'created_at'],
        'foreign_keys': {
            'user_id': 'users'
        }
    },
    'push_subscriptions': {
        'required_fields': ['id', 'user_id', 'endpoint', 'keys', 'created_at'],
        'foreign_keys': {
            'user_id': 'users'
        }
    },
    'system_settings': {
        'required_fields': ['id', 'key', 'value'],
        'unique_fields': ['key']
    },
    'audit_logs': {
        'required_fields': ['id', 'table_name', 'operation', 'record_id', 'payload', 'created_at'],
        'enum_fields': {
            'operation': ['CREATE', 'UPDATE', 'DELETE']
        }
    },
    'sync_events': {
        'required_fields': ['id', 'event_type', 'payload', 'processed', 'created_at']
    }
}


class DataValidator:
    """Data validator for migration data."""
    
    def __init__(self, data_dir: str, strict_mode: bool = False):
        self.data_dir = data_dir
        self.strict_mode = strict_mode
        self.validation_errors = []
        self.validation_warnings = []
        self.data_cache = {}
        
    def load_table_data(self, table_name: str) -> List[Dict[str, Any]]:
        """Load data from JSON file."""
        if table_name in self.data_cache:
            return self.data_cache[table_name]
        
        json_path = os.path.join(self.data_dir, f"{table_name}.json")
        
        if not os.path.exists(json_path):
            logger.warning(f"Table data file not found: {json_path}")
            return []
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                self.validation_errors.append(f"Invalid data format in {table_name}.json - expected list")
                return []
            
            self.data_cache[table_name] = data
            return data
            
        except json.JSONDecodeError as e:
            self.validation_errors.append(f"Invalid JSON in {table_name}.json: {e}")
            return []
        except Exception as e:
            self.validation_errors.append(f"Error loading {table_name}.json: {e}")
            return []
    
    def validate_required_fields(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate required fields are present."""
        if not data:
            return True
        
        schema = TABLE_SCHEMAS.get(table_name, {})
        required_fields = schema.get('required_fields', [])
        
        if not required_fields:
            return True
        
        valid = True
        
        for i, record in enumerate(data):
            for field in required_fields:
                if field not in record:
                    self.validation_errors.append(
                        f"{table_name}[{i}]: Missing required field '{field}'"
                    )
                    valid = False
                elif record[field] is None and field in ['id', 'created_at']:
                    self.validation_errors.append(
                        f"{table_name}[{i}]: Required field '{field}' cannot be null"
                    )
                    valid = False
        
        return valid
    
    def validate_unique_fields(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate unique field constraints."""
        if not data:
            return True
        
        schema = TABLE_SCHEMAS.get(table_name, {})
        unique_fields = schema.get('unique_fields', [])
        
        if not unique_fields:
            return True
        
        valid = True
        
        for field in unique_fields:
            seen_values = set()
            for i, record in enumerate(data):
                if field in record and record[field] is not None:
                    value = record[field]
                    if value in seen_values:
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Duplicate value '{value}' for unique field '{field}'"
                        )
                        valid = False
                    seen_values.add(value)
        
        return valid
    
    def validate_enum_fields(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate enum field values."""
        if not data:
            return True
        
        schema = TABLE_SCHEMAS.get(table_name, {})
        enum_fields = schema.get('enum_fields', {})
        
        if not enum_fields:
            return True
        
        valid = True
        
        for field, allowed_values in enum_fields.items():
            for i, record in enumerate(data):
                if field in record and record[field] is not None:
                    value = record[field]
                    if value not in allowed_values:
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Invalid value '{value}' for enum field '{field}'. "
                            f"Allowed values: {allowed_values}"
                        )
                        valid = False
        
        return valid
    
    def validate_foreign_keys(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate foreign key references."""
        if not data:
            return True
        
        schema = TABLE_SCHEMAS.get(table_name, {})
        foreign_keys = schema.get('foreign_keys', {})
        
        if not foreign_keys:
            return True
        
        valid = True
        
        for fk_field, ref_table in foreign_keys.items():
            # Load referenced table data
            ref_data = self.load_table_data(ref_table)
            if not ref_data:
                if self.strict_mode:
                    self.validation_errors.append(
                        f"Cannot validate foreign key {table_name}.{fk_field} -> {ref_table}: "
                        f"Referenced table data not found"
                    )
                    valid = False
                else:
                    self.validation_warnings.append(
                        f"Skipping foreign key validation for {table_name}.{fk_field} -> {ref_table}: "
                        f"Referenced table data not found"
                    )
                continue
            
            # Build set of valid IDs
            valid_ids = {record['id'] for record in ref_data if 'id' in record}
            
            # Validate foreign key references
            for i, record in enumerate(data):
                if fk_field in record and record[fk_field] is not None:
                    fk_value = record[fk_field]
                    if fk_value not in valid_ids:
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Invalid foreign key reference "
                            f"{fk_field}={fk_value} -> {ref_table}"
                        )
                        valid = False
        
        return valid
    
    def validate_unique_together(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate unique together constraints."""
        if not data:
            return True
        
        schema = TABLE_SCHEMAS.get(table_name, {})
        unique_together = schema.get('unique_together', [])
        
        if not unique_together:
            return True
        
        valid = True
        
        for field_combination in unique_together:
            seen_combinations = set()
            for i, record in enumerate(data):
                # Build tuple of values for the field combination
                values = []
                for field in field_combination:
                    if field in record:
                        values.append(record[field])
                    else:
                        values.append(None)
                
                combination = tuple(values)
                if combination in seen_combinations:
                    self.validation_errors.append(
                        f"{table_name}[{i}]: Duplicate combination for unique_together "
                        f"{field_combination}: {combination}"
                    )
                    valid = False
                seen_combinations.add(combination)
        
        return valid
    
    def validate_data_types(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate data types and formats."""
        if not data:
            return True
        
        valid = True
        
        for i, record in enumerate(data):
            # Validate timestamps
            for field, value in record.items():
                if field.endswith('_at') or field == 'date_recorded':
                    if value is not None and not self._is_valid_timestamp(value):
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Invalid timestamp format for '{field}': {value}"
                        )
                        valid = False
                
                # Validate dates
                elif field in ['date', 'birthdate', 'date_absent']:
                    if value is not None and not self._is_valid_date(value):
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Invalid date format for '{field}': {value}"
                        )
                        valid = False
                
                # Validate emails
                elif field == 'email':
                    if value is not None and not self._is_valid_email(value):
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Invalid email format for '{field}': {value}"
                        )
                        valid = False
                
                # Validate URLs
                elif field in ['profile_pic', 'file_url', 'image_url', 'image_path', 'facebook_link']:
                    if value is not None and value.strip() and not self._is_valid_url(value):
                        self.validation_warnings.append(
                            f"{table_name}[{i}]: Potentially invalid URL for '{field}': {value}"
                        )
                
                # Validate JSON fields
                elif field in ['payload', 'keys', 'images']:
                    if value is not None and not isinstance(value, (dict, list)):
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Invalid JSON format for '{field}': {type(value)}"
                        )
                        valid = False
        
        return valid
    
    def validate_business_rules(self, table_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate business logic rules."""
        if not data:
            return True
        
        valid = True
        
        # Merit/demerit points should be positive
        if table_name == 'merit_demerit_logs':
            for i, record in enumerate(data):
                if 'points' in record and record['points'] is not None:
                    if record['points'] <= 0:
                        self.validation_errors.append(
                            f"{table_name}[{i}]: Merit/demerit points must be positive: {record['points']}"
                        )
                        valid = False
        
        # Grades should have non-negative values
        elif table_name == 'grades':
            for i, record in enumerate(data):
                for field in ['attendance_present', 'merit_points', 'demerit_points']:
                    if field in record and record[field] is not None:
                        if record[field] < 0:
                            self.validation_errors.append(
                                f"{table_name}[{i}]: {field} cannot be negative: {record[field]}"
                            )
                            valid = False
        
        # User role consistency
        elif table_name == 'users':
            for i, record in enumerate(data):
                role = record.get('role')
                cadet_id = record.get('cadet_id')
                staff_id = record.get('staff_id')
                
                if role == 'cadet' and cadet_id is None:
                    self.validation_warnings.append(
                        f"{table_name}[{i}]: User with role 'cadet' should have cadet_id"
                    )
                elif role == 'training_staff' and staff_id is None:
                    self.validation_warnings.append(
                        f"{table_name}[{i}]: User with role 'training_staff' should have staff_id"
                    )
        
        return valid
    
    def _is_valid_timestamp(self, value: str) -> bool:
        """Check if value is a valid ISO timestamp."""
        try:
            datetime.fromisoformat(value.replace('Z', '+00:00'))
            return True
        except (ValueError, AttributeError):
            return False
    
    def _is_valid_date(self, value: str) -> bool:
        """Check if value is a valid ISO date."""
        try:
            datetime.fromisoformat(value).date()
            return True
        except (ValueError, AttributeError):
            return False
    
    def _is_valid_email(self, value: str) -> bool:
        """Check if value is a valid email format."""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(email_pattern, value) is not None
    
    def _is_valid_url(self, value: str) -> bool:
        """Check if value is a valid URL format."""
        try:
            result = urlparse(value)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    def validate_table(self, table_name: str) -> bool:
        """Validate a single table."""
        logger.info(f"Validating table: {table_name}")
        
        data = self.load_table_data(table_name)
        if not data:
            logger.info(f"No data found for table {table_name}, skipping validation")
            return True
        
        logger.info(f"Validating {len(data)} records in {table_name}")
        
        valid = True
        valid &= self.validate_required_fields(table_name, data)
        valid &= self.validate_unique_fields(table_name, data)
        valid &= self.validate_enum_fields(table_name, data)
        valid &= self.validate_foreign_keys(table_name, data)
        valid &= self.validate_unique_together(table_name, data)
        valid &= self.validate_data_types(table_name, data)
        valid &= self.validate_business_rules(table_name, data)
        
        if valid:
            logger.info(f"✓ Table {table_name} validation passed")
        else:
            logger.error(f"✗ Table {table_name} validation failed")
        
        return valid
    
    def validate_all_tables(self) -> bool:
        """Validate all tables."""
        logger.info("Starting data validation...")
        
        overall_valid = True
        
        for table_name in TABLE_SCHEMAS.keys():
            table_valid = self.validate_table(table_name)
            overall_valid &= table_valid
        
        # Print summary
        logger.info(f"\nValidation Summary:")
        logger.info(f"Errors: {len(self.validation_errors)}")
        logger.info(f"Warnings: {len(self.validation_warnings)}")
        
        if self.validation_errors:
            logger.error("\nValidation Errors:")
            for error in self.validation_errors:
                logger.error(f"  - {error}")
        
        if self.validation_warnings:
            logger.warning("\nValidation Warnings:")
            for warning in self.validation_warnings:
                logger.warning(f"  - {warning}")
        
        if overall_valid:
            logger.info("\n✓ All data validation checks passed")
        else:
            logger.error("\n✗ Data validation failed")
        
        return overall_valid


def main():
    """Main validation function."""
    parser = argparse.ArgumentParser(description='Validate migration data before import')
    parser.add_argument('--data-dir', required=True, help='Directory containing JSON export files')
    parser.add_argument('--strict', action='store_true', help='Enable strict validation mode')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.data_dir):
        logger.error(f"Data directory does not exist: {args.data_dir}")
        sys.exit(1)
    
    # Initialize validator
    validator = DataValidator(args.data_dir, args.strict)
    
    # Run validation
    if validator.validate_all_tables():
        logger.info("Data validation completed successfully")
        sys.exit(0)
    else:
        logger.error("Data validation failed")
        sys.exit(1)


if __name__ == '__main__':
    main()