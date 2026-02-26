#!/usr/bin/env python3
"""
Data export script for Node.js database.
Exports all 19 tables to JSON format preserving data integrity.

Usage:
    python export_nodejs_data.py --db-url postgresql://user:pass@host:port/db --output-dir ./exports
    python export_nodejs_data.py --db-url sqlite:///path/to/db.sqlite --output-dir ./exports
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, List, Any, Optional
import psycopg2
import psycopg2.extras
import sqlite3
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# All 19 tables to export in dependency order
TABLES_TO_EXPORT = [
    'users',
    'user_settings', 
    'cadets',
    'grades',
    'training_staff',
    'training_days',
    'attendance_records',
    'staff_attendance_records',
    'excuse_letters',
    'merit_demerit_logs',
    'activities',
    'activity_images',
    'admin_messages',
    'staff_messages',
    'notifications',
    'push_subscriptions',
    'system_settings',
    'audit_logs',
    'sync_events'
]


class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for handling special data types."""
    
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, date):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        elif obj is None:
            return None
        return super().default(obj)


class DatabaseExporter:
    """Database exporter for Node.js data."""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.connection = None
        self.db_type = self._detect_db_type()
        
    def _detect_db_type(self) -> str:
        """Detect database type from URL."""
        parsed = urlparse(self.db_url)
        if parsed.scheme.startswith('postgresql'):
            return 'postgresql'
        elif parsed.scheme.startswith('sqlite'):
            return 'sqlite'
        else:
            raise ValueError(f"Unsupported database type: {parsed.scheme}")
    
    def connect(self):
        """Establish database connection."""
        try:
            if self.db_type == 'postgresql':
                self.connection = psycopg2.connect(self.db_url)
                logger.info("Connected to PostgreSQL database")
            elif self.db_type == 'sqlite':
                # Extract path from sqlite URL
                db_path = self.db_url.replace('sqlite:///', '')
                self.connection = sqlite3.connect(db_path)
                self.connection.row_factory = sqlite3.Row  # Enable dict-like access
                logger.info(f"Connected to SQLite database: {db_path}")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def disconnect(self):
        """Close database connection."""
        if self.connection:
            self.connection.close()
            logger.info("Database connection closed")
    
    def get_table_schema(self, table_name: str) -> List[str]:
        """Get column names for a table."""
        try:
            cursor = self.connection.cursor()
            
            if self.db_type == 'postgresql':
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = %s 
                    ORDER BY ordinal_position
                """, (table_name,))
                columns = [row[0] for row in cursor.fetchall()]
            else:  # sqlite
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [row[1] for row in cursor.fetchall()]
            
            cursor.close()
            return columns
            
        except Exception as e:
            logger.error(f"Failed to get schema for table {table_name}: {e}")
            return []
    
    def export_table(self, table_name: str) -> List[Dict[str, Any]]:
        """Export all data from a table."""
        try:
            cursor = self.connection.cursor()
            
            if self.db_type == 'postgresql':
                cursor = self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            cursor.execute(f"SELECT * FROM {table_name} ORDER BY id")
            
            if self.db_type == 'postgresql':
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]
            else:  # sqlite
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]
            
            cursor.close()
            logger.info(f"Exported {len(data)} records from {table_name}")
            return data
            
        except Exception as e:
            logger.error(f"Failed to export table {table_name}: {e}")
            return []
    
    def validate_table_exists(self, table_name: str) -> bool:
        """Check if table exists in database."""
        try:
            cursor = self.connection.cursor()
            
            if self.db_type == 'postgresql':
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = %s
                    )
                """, (table_name,))
                exists = cursor.fetchone()[0]
            else:  # sqlite
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                """, (table_name,))
                exists = cursor.fetchone() is not None
            
            cursor.close()
            return exists
            
        except Exception as e:
            logger.error(f"Failed to check if table {table_name} exists: {e}")
            return False


def create_export_metadata(output_dir: str, db_url: str, exported_tables: List[str]):
    """Create metadata file with export information."""
    metadata = {
        'export_timestamp': datetime.now().isoformat(),
        'source_database': db_url,
        'exported_tables': exported_tables,
        'total_tables': len(exported_tables),
        'export_format': 'JSON',
        'schema_version': '1.0'
    }
    
    metadata_path = os.path.join(output_dir, 'export_metadata.json')
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, cls=JSONEncoder)
    
    logger.info(f"Export metadata saved to {metadata_path}")


def validate_exported_data(output_dir: str) -> bool:
    """Validate exported data integrity."""
    logger.info("Validating exported data...")
    
    validation_errors = []
    
    for table_name in TABLES_TO_EXPORT:
        json_path = os.path.join(output_dir, f"{table_name}.json")
        
        if not os.path.exists(json_path):
            validation_errors.append(f"Missing export file: {json_path}")
            continue
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                validation_errors.append(f"Invalid data format in {table_name}.json - expected list")
                continue
            
            # Validate required fields for key tables
            if table_name == 'users' and data:
                required_fields = ['id', 'username', 'email', 'password', 'role']
                for field in required_fields:
                    if field not in data[0]:
                        validation_errors.append(f"Missing required field '{field}' in users table")
            
            elif table_name == 'cadets' and data:
                required_fields = ['id', 'student_id', 'first_name', 'last_name']
                for field in required_fields:
                    if field not in data[0]:
                        validation_errors.append(f"Missing required field '{field}' in cadets table")
            
            logger.info(f"Validated {table_name}: {len(data)} records")
            
        except json.JSONDecodeError as e:
            validation_errors.append(f"Invalid JSON in {table_name}.json: {e}")
        except Exception as e:
            validation_errors.append(f"Error validating {table_name}.json: {e}")
    
    if validation_errors:
        logger.error("Validation errors found:")
        for error in validation_errors:
            logger.error(f"  - {error}")
        return False
    
    logger.info("All exported data validated successfully")
    return True


def main():
    """Main export function."""
    parser = argparse.ArgumentParser(description='Export Node.js database to JSON files')
    parser.add_argument('--db-url', required=True, help='Database connection URL')
    parser.add_argument('--output-dir', required=True, help='Output directory for JSON files')
    parser.add_argument('--validate', action='store_true', help='Validate exported data')
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    logger.info(f"Export directory: {args.output_dir}")
    
    # Initialize exporter
    exporter = DatabaseExporter(args.db_url)
    
    try:
        # Connect to database
        exporter.connect()
        
        exported_tables = []
        
        # Export each table
        for table_name in TABLES_TO_EXPORT:
            logger.info(f"Processing table: {table_name}")
            
            # Check if table exists
            if not exporter.validate_table_exists(table_name):
                logger.warning(f"Table {table_name} does not exist, skipping...")
                continue
            
            # Export table data
            data = exporter.export_table(table_name)
            
            # Save to JSON file
            json_path = os.path.join(args.output_dir, f"{table_name}.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, cls=JSONEncoder, ensure_ascii=False)
            
            logger.info(f"Saved {len(data)} records to {json_path}")
            exported_tables.append(table_name)
        
        # Create export metadata
        create_export_metadata(args.output_dir, args.db_url, exported_tables)
        
        # Validate exported data if requested
        if args.validate:
            if not validate_exported_data(args.output_dir):
                logger.error("Data validation failed")
                sys.exit(1)
        
        logger.info(f"Export completed successfully. {len(exported_tables)} tables exported.")
        
    except Exception as e:
        logger.error(f"Export failed: {e}")
        sys.exit(1)
    
    finally:
        exporter.disconnect()


if __name__ == '__main__':
    main()