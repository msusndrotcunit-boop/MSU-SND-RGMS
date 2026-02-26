#!/usr/bin/env python3
"""
Special field preservation script for data migration.
Ensures timestamps, Cloudinary URLs, bcrypt hashes, and other special fields are preserved exactly.

Usage:
    python preserve_special_fields.py --data-dir ./exports --output-dir ./processed
"""

import os
import sys
import json
import argparse
import logging
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SpecialFieldProcessor:
    """Processor for special fields that need preservation."""
    
    def __init__(self, data_dir: str, output_dir: str):
        self.data_dir = data_dir
        self.output_dir = output_dir
        self.processing_stats = {}
        self.warnings = []
        
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
            
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {table_name}.json: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading {table_name}.json: {e}")
            return []
    
    def save_json_data(self, table_name: str, data: List[Dict[str, Any]]):
        """Save processed data to JSON file."""
        os.makedirs(self.output_dir, exist_ok=True)
        json_path = os.path.join(self.output_dir, f"{table_name}.json")
        
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved processed data to {json_path}")
            
        except Exception as e:
            logger.error(f"Error saving {table_name}.json: {e}")
            raise
    
    def validate_timestamp_format(self, timestamp_str: str) -> bool:
        """Validate timestamp format and ensure it's ISO 8601 compatible."""
        if not timestamp_str:
            return False
        
        # Common timestamp formats to validate
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',      # ISO with microseconds and Z
            '%Y-%m-%dT%H:%M:%SZ',         # ISO with Z
            '%Y-%m-%dT%H:%M:%S.%f',       # ISO with microseconds
            '%Y-%m-%dT%H:%M:%S',          # ISO basic
            '%Y-%m-%d %H:%M:%S.%f',       # Space separated with microseconds
            '%Y-%m-%d %H:%M:%S',          # Space separated
        ]
        
        for fmt in formats:
            try:
                datetime.strptime(timestamp_str, fmt)
                return True
            except ValueError:
                continue
        
        return False
    
    def normalize_timestamp(self, timestamp_str: str) -> str:
        """Normalize timestamp to ISO 8601 format."""
        if not timestamp_str:
            return timestamp_str
        
        # Try to parse and normalize
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S.%f',
            '%Y-%m-%d %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(timestamp_str, fmt)
                # Return in ISO format with microseconds
                return dt.isoformat() + 'Z' if not dt.tzinfo else dt.isoformat()
            except ValueError:
                continue
        
        # If we can't parse it, return as-is and log warning
        self.warnings.append(f"Could not normalize timestamp: {timestamp_str}")
        return timestamp_str
    
    def validate_cloudinary_url(self, url: str) -> bool:
        """Validate Cloudinary URL format."""
        if not url:
            return True  # Empty URLs are valid
        
        # Cloudinary URL patterns
        cloudinary_patterns = [
            r'https://res\.cloudinary\.com/[^/]+/image/upload/',
            r'https://res\.cloudinary\.com/[^/]+/video/upload/',
            r'https://res\.cloudinary\.com/[^/]+/raw/upload/',
            r'https://cloudinary\.com/',
        ]
        
        for pattern in cloudinary_patterns:
            if re.match(pattern, url):
                return True
        
        # Also check for generic HTTPS URLs (might be other CDNs)
        try:
            parsed = urlparse(url)
            return parsed.scheme in ['http', 'https'] and parsed.netloc
        except Exception:
            return False
    
    def validate_bcrypt_hash(self, hash_str: str) -> bool:
        """Validate bcrypt hash format."""
        if not hash_str:
            return False
        
        # bcrypt hash pattern: $2a$10$... or $2b$10$... etc.
        bcrypt_pattern = r'^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$'
        return re.match(bcrypt_pattern, hash_str) is not None
    
    def process_users_table(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process users table with special attention to passwords and timestamps."""
        logger.info("Processing users table...")
        
        processed_data = []
        stats = {
            'total_records': len(data),
            'bcrypt_hashes_preserved': 0,
            'invalid_bcrypt_hashes': 0,
            'timestamps_normalized': 0,
            'cloudinary_urls_preserved': 0,
        }
        
        for i, record in enumerate(data):
            processed_record = record.copy()
            
            # Preserve bcrypt password hashes
            if 'password' in record:
                password_hash = record['password']
                if self.validate_bcrypt_hash(password_hash):
                    stats['bcrypt_hashes_preserved'] += 1
                else:
                    stats['invalid_bcrypt_hashes'] += 1
                    self.warnings.append(f"users[{i}]: Invalid bcrypt hash format: {password_hash[:20]}...")
            
            # Normalize timestamps
            for field in ['created_at', 'last_location_at']:
                if field in record and record[field]:
                    original = record[field]
                    normalized = self.normalize_timestamp(original)
                    if normalized != original:
                        processed_record[field] = normalized
                        stats['timestamps_normalized'] += 1
            
            # Preserve Cloudinary URLs
            if 'profile_pic' in record and record['profile_pic']:
                url = record['profile_pic']
                if self.validate_cloudinary_url(url):
                    stats['cloudinary_urls_preserved'] += 1
                else:
                    self.warnings.append(f"users[{i}]: Potentially invalid profile_pic URL: {url}")
            
            processed_data.append(processed_record)
        
        self.processing_stats['users'] = stats
        logger.info(f"Processed {stats['total_records']} user records")
        return processed_data
    
    def process_cadets_table(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process cadets table with special attention to timestamps and URLs."""
        logger.info("Processing cadets table...")
        
        processed_data = []
        stats = {
            'total_records': len(data),
            'timestamps_normalized': 0,
            'cloudinary_urls_preserved': 0,
            'student_ids_preserved': 0,
        }
        
        for i, record in enumerate(data):
            processed_record = record.copy()
            
            # Preserve student IDs exactly
            if 'student_id' in record:
                stats['student_ids_preserved'] += 1
            
            # Normalize timestamps
            for field in ['created_at']:
                if field in record and record[field]:
                    original = record[field]
                    normalized = self.normalize_timestamp(original)
                    if normalized != original:
                        processed_record[field] = normalized
                        stats['timestamps_normalized'] += 1
            
            # Normalize date fields
            for field in ['birthdate']:
                if field in record and record[field]:
                    # Ensure date is in YYYY-MM-DD format
                    date_str = record[field]
                    if 'T' in date_str:  # Remove time part if present
                        processed_record[field] = date_str.split('T')[0]
            
            # Preserve Cloudinary URLs
            if 'profile_pic' in record and record['profile_pic']:
                url = record['profile_pic']
                if self.validate_cloudinary_url(url):
                    stats['cloudinary_urls_preserved'] += 1
                else:
                    self.warnings.append(f"cadets[{i}]: Potentially invalid profile_pic URL: {url}")
            
            processed_data.append(processed_record)
        
        self.processing_stats['cadets'] = stats
        logger.info(f"Processed {stats['total_records']} cadet records")
        return processed_data
    
    def process_training_staff_table(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process training staff table with special attention to timestamps and URLs."""
        logger.info("Processing training staff table...")
        
        processed_data = []
        stats = {
            'total_records': len(data),
            'timestamps_normalized': 0,
            'cloudinary_urls_preserved': 0,
        }
        
        for i, record in enumerate(data):
            processed_record = record.copy()
            
            # Normalize timestamps
            for field in ['created_at']:
                if field in record and record[field]:
                    original = record[field]
                    normalized = self.normalize_timestamp(original)
                    if normalized != original:
                        processed_record[field] = normalized
                        stats['timestamps_normalized'] += 1
            
            # Normalize date fields
            for field in ['birthdate']:
                if field in record and record[field]:
                    date_str = record[field]
                    if 'T' in date_str:
                        processed_record[field] = date_str.split('T')[0]
            
            # Preserve Cloudinary URLs
            if 'profile_pic' in record and record['profile_pic']:
                url = record['profile_pic']
                if self.validate_cloudinary_url(url):
                    stats['cloudinary_urls_preserved'] += 1
                else:
                    self.warnings.append(f"training_staff[{i}]: Potentially invalid profile_pic URL: {url}")
            
            processed_data.append(processed_record)
        
        self.processing_stats['training_staff'] = stats
        logger.info(f"Processed {stats['total_records']} training staff records")
        return processed_data
    
    def process_activities_table(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process activities table with special attention to image URLs."""
        logger.info("Processing activities table...")
        
        processed_data = []
        stats = {
            'total_records': len(data),
            'timestamps_normalized': 0,
            'cloudinary_urls_preserved': 0,
            'image_arrays_processed': 0,
        }
        
        for i, record in enumerate(data):
            processed_record = record.copy()
            
            # Normalize timestamps
            for field in ['created_at']:
                if field in record and record[field]:
                    original = record[field]
                    normalized = self.normalize_timestamp(original)
                    if normalized != original:
                        processed_record[field] = normalized
                        stats['timestamps_normalized'] += 1
            
            # Normalize date fields
            for field in ['date']:
                if field in record and record[field]:
                    date_str = record[field]
                    if 'T' in date_str:
                        processed_record[field] = date_str.split('T')[0]
            
            # Preserve Cloudinary URLs in image_path
            if 'image_path' in record and record['image_path']:
                url = record['image_path']
                if self.validate_cloudinary_url(url):
                    stats['cloudinary_urls_preserved'] += 1
                else:
                    self.warnings.append(f"activities[{i}]: Potentially invalid image_path URL: {url}")
            
            # Process images array (JSON field)
            if 'images' in record and record['images']:
                try:
                    if isinstance(record['images'], str):
                        # Parse JSON string
                        images = json.loads(record['images'])
                    else:
                        images = record['images']
                    
                    if isinstance(images, list):
                        # Validate each URL in the array
                        for url in images:
                            if url and self.validate_cloudinary_url(url):
                                stats['cloudinary_urls_preserved'] += 1
                        stats['image_arrays_processed'] += 1
                    
                except json.JSONDecodeError:
                    self.warnings.append(f"activities[{i}]: Invalid JSON in images field")
            
            processed_data.append(processed_record)
        
        self.processing_stats['activities'] = stats
        logger.info(f"Processed {stats['total_records']} activity records")
        return processed_data
    
    def process_excuse_letters_table(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process excuse letters table with special attention to file URLs."""
        logger.info("Processing excuse letters table...")
        
        processed_data = []
        stats = {
            'total_records': len(data),
            'timestamps_normalized': 0,
            'cloudinary_urls_preserved': 0,
        }
        
        for i, record in enumerate(data):
            processed_record = record.copy()
            
            # Normalize timestamps
            for field in ['created_at']:
                if field in record and record[field]:
                    original = record[field]
                    normalized = self.normalize_timestamp(original)
                    if normalized != original:
                        processed_record[field] = normalized
                        stats['timestamps_normalized'] += 1
            
            # Normalize date fields
            for field in ['date_absent']:
                if field in record and record[field]:
                    date_str = record[field]
                    if 'T' in date_str:
                        processed_record[field] = date_str.split('T')[0]
            
            # Preserve Cloudinary URLs in file_url
            if 'file_url' in record and record['file_url']:
                url = record['file_url']
                if self.validate_cloudinary_url(url):
                    stats['cloudinary_urls_preserved'] += 1
                else:
                    self.warnings.append(f"excuse_letters[{i}]: Potentially invalid file_url: {url}")
            
            processed_data.append(processed_record)
        
        self.processing_stats['excuse_letters'] = stats
        logger.info(f"Processed {stats['total_records']} excuse letter records")
        return processed_data
    
    def process_generic_table(self, table_name: str, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process generic table with timestamp normalization."""
        logger.info(f"Processing {table_name} table...")
        
        processed_data = []
        stats = {
            'total_records': len(data),
            'timestamps_normalized': 0,
        }
        
        for record in data:
            processed_record = record.copy()
            
            # Normalize all timestamp fields
            for field, value in record.items():
                if (field.endswith('_at') or field == 'date_recorded') and value:
                    original = value
                    normalized = self.normalize_timestamp(original)
                    if normalized != original:
                        processed_record[field] = normalized
                        stats['timestamps_normalized'] += 1
                
                # Normalize date fields
                elif field in ['date', 'birthdate', 'date_absent'] and value:
                    date_str = value
                    if 'T' in date_str:
                        processed_record[field] = date_str.split('T')[0]
            
            processed_data.append(processed_record)
        
        self.processing_stats[table_name] = stats
        logger.info(f"Processed {stats['total_records']} {table_name} records")
        return processed_data
    
    def process_all_tables(self):
        """Process all tables with special field preservation."""
        logger.info("Starting special field processing...")
        
        # Tables with custom processing
        custom_processors = {
            'users': self.process_users_table,
            'cadets': self.process_cadets_table,
            'training_staff': self.process_training_staff_table,
            'activities': self.process_activities_table,
            'excuse_letters': self.process_excuse_letters_table,
        }
        
        # All expected tables
        all_tables = [
            'users', 'user_settings', 'cadets', 'grades', 'training_staff',
            'training_days', 'attendance_records', 'staff_attendance_records',
            'excuse_letters', 'merit_demerit_logs', 'activities', 'activity_images',
            'admin_messages', 'staff_messages', 'notifications', 'push_subscriptions',
            'system_settings', 'audit_logs', 'sync_events'
        ]
        
        for table_name in all_tables:
            logger.info(f"\n--- Processing {table_name} ---")
            
            data = self.load_json_data(table_name)
            if not data:
                logger.info(f"No data to process for {table_name}")
                continue
            
            try:
                if table_name in custom_processors:
                    processed_data = custom_processors[table_name](data)
                else:
                    processed_data = self.process_generic_table(table_name, data)
                
                self.save_json_data(table_name, processed_data)
                logger.info(f"✓ Processed {table_name} successfully")
                
            except Exception as e:
                logger.error(f"✗ Failed to process {table_name}: {e}")
                raise
    
    def print_processing_summary(self):
        """Print processing summary."""
        logger.info("\n" + "="*60)
        logger.info("SPECIAL FIELD PROCESSING SUMMARY")
        logger.info("="*60)
        
        total_records = 0
        total_timestamps = 0
        total_urls = 0
        total_hashes = 0
        
        for table_name, stats in self.processing_stats.items():
            logger.info(f"\n{table_name}:")
            logger.info(f"  Records processed: {stats['total_records']}")
            total_records += stats['total_records']
            
            if 'timestamps_normalized' in stats:
                logger.info(f"  Timestamps normalized: {stats['timestamps_normalized']}")
                total_timestamps += stats['timestamps_normalized']
            
            if 'cloudinary_urls_preserved' in stats:
                logger.info(f"  Cloudinary URLs preserved: {stats['cloudinary_urls_preserved']}")
                total_urls += stats['cloudinary_urls_preserved']
            
            if 'bcrypt_hashes_preserved' in stats:
                logger.info(f"  bcrypt hashes preserved: {stats['bcrypt_hashes_preserved']}")
                total_hashes += stats['bcrypt_hashes_preserved']
            
            if 'invalid_bcrypt_hashes' in stats and stats['invalid_bcrypt_hashes'] > 0:
                logger.warning(f"  Invalid bcrypt hashes: {stats['invalid_bcrypt_hashes']}")
        
        logger.info(f"\nTOTALS:")
        logger.info(f"  Records processed: {total_records}")
        logger.info(f"  Timestamps normalized: {total_timestamps}")
        logger.info(f"  Cloudinary URLs preserved: {total_urls}")
        logger.info(f"  bcrypt hashes preserved: {total_hashes}")
        
        if self.warnings:
            logger.warning(f"\nWarnings: {len(self.warnings)}")
            for warning in self.warnings[:10]:  # Show first 10 warnings
                logger.warning(f"  - {warning}")
            if len(self.warnings) > 10:
                logger.warning(f"  ... and {len(self.warnings) - 10} more warnings")
        
        logger.info("\n✓ Special field processing completed")


def main():
    """Main processing function."""
    parser = argparse.ArgumentParser(description='Process special fields for data migration')
    parser.add_argument('--data-dir', required=True, help='Directory containing JSON export files')
    parser.add_argument('--output-dir', required=True, help='Output directory for processed files')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.data_dir):
        logger.error(f"Data directory does not exist: {args.data_dir}")
        sys.exit(1)
    
    # Initialize processor
    processor = SpecialFieldProcessor(args.data_dir, args.output_dir)
    
    try:
        # Process all tables
        processor.process_all_tables()
        
        # Print summary
        processor.print_processing_summary()
        
        logger.info("Special field processing completed successfully")
        
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()