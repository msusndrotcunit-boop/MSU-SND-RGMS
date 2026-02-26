"""
Import utilities for processing ROTCMIS data and CSV imports
"""
import csv
import io
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from django.db import transaction
from django.core.exceptions import ValidationError


class ImportResult:
    """Container for import operation results"""
    
    def __init__(self):
        self.success_count = 0
        self.error_count = 0
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[str] = []
        self.created_ids: List[int] = []
        self.updated_ids: List[int] = []
    
    def add_success(self, record_id: int, created: bool = True):
        """Record a successful import"""
        self.success_count += 1
        if created:
            self.created_ids.append(record_id)
        else:
            self.updated_ids.append(record_id)
    
    def add_error(self, row_num: int, field: str, message: str, data: Optional[Dict] = None):
        """Record an import error"""
        self.error_count += 1
        self.errors.append({
            'row': row_num,
            'field': field,
            'message': message,
            'data': data
        })
    
    def add_warning(self, message: str):
        """Record a warning"""
        self.warnings.append(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            'success_count': self.success_count,
            'error_count': self.error_count,
            'total_processed': self.success_count + self.error_count,
            'created_count': len(self.created_ids),
            'updated_count': len(self.updated_ids),
            'errors': self.errors,
            'warnings': self.warnings,
            'created_ids': self.created_ids,
            'updated_ids': self.updated_ids
        }


class ROTCMISImporter:
    """Importer for ROTCMIS JSON data format"""
    
    @staticmethod
    def validate_cadet_data(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate cadet data from ROTCMIS
        
        Args:
            data: Dictionary containing cadet data
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Required fields
        required_fields = ['student_id', 'first_name', 'last_name']
        for field in required_fields:
            if not data.get(field):
                errors.append(f"Missing required field: {field}")
        
        # Validate student_id format (if present)
        if data.get('student_id'):
            student_id = str(data['student_id']).strip()
            if len(student_id) < 3:
                errors.append("student_id must be at least 3 characters")
        
        # Validate email format (if present)
        if data.get('email'):
            email = data['email'].strip()
            if '@' not in email:
                errors.append("Invalid email format")
        
        # Validate year_level (if present)
        if data.get('year_level'):
            try:
                year_level = int(data['year_level'])
                if year_level < 1 or year_level > 5:
                    errors.append("year_level must be between 1 and 5")
            except (ValueError, TypeError):
                errors.append("year_level must be a number")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def normalize_cadet_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize ROTCMIS cadet data to match Django model fields
        
        Args:
            data: Raw ROTCMIS data
            
        Returns:
            Normalized data dictionary
        """
        normalized = {}
        
        # Map ROTCMIS fields to Django model fields
        field_mapping = {
            'student_id': 'student_id',
            'studentId': 'student_id',
            'first_name': 'first_name',
            'firstName': 'first_name',
            'last_name': 'last_name',
            'lastName': 'last_name',
            'middle_name': 'middle_name',
            'middleName': 'middle_name',
            'suffix_name': 'suffix_name',
            'suffixName': 'suffix_name',
            'company': 'company',
            'platoon': 'platoon',
            'course': 'course',
            'year_level': 'year_level',
            'yearLevel': 'year_level',
            'status': 'status',
            'email': 'email',
            'contact_number': 'contact_number',
            'contactNumber': 'contact_number',
            'birthdate': 'birthdate',
            'birthplace': 'birthplace',
            'age': 'age',
            'height': 'height',
            'weight': 'weight',
            'blood_type': 'blood_type',
            'bloodType': 'blood_type',
            'address': 'address',
            'civil_status': 'civil_status',
            'civilStatus': 'civil_status',
            'nationality': 'nationality',
            'gender': 'gender',
            'language_spoken': 'language_spoken',
            'languageSpoken': 'language_spoken',
        }
        
        for source_key, target_key in field_mapping.items():
            if source_key in data and data[source_key] is not None:
                normalized[target_key] = data[source_key]
        
        # Set defaults
        if 'status' not in normalized:
            normalized['status'] = 'Ongoing'
        
        return normalized


class CSVImporter:
    """Importer for CSV data"""
    
    @staticmethod
    def parse_csv(csv_content: str) -> List[Dict[str, Any]]:
        """
        Parse CSV content into list of dictionaries
        
        Args:
            csv_content: CSV file content as string
            
        Returns:
            List of dictionaries with CSV data
        """
        reader = csv.DictReader(io.StringIO(csv_content))
        return list(reader)
    
    @staticmethod
    def parse_csv_file(file) -> List[Dict[str, Any]]:
        """
        Parse uploaded CSV file
        
        Args:
            file: Django UploadedFile object
            
        Returns:
            List of dictionaries with CSV data
        """
        content = file.read().decode('utf-8')
        return CSVImporter.parse_csv(content)
    
    @staticmethod
    def validate_headers(data: List[Dict[str, Any]], required_headers: List[str]) -> Tuple[bool, List[str]]:
        """
        Validate that CSV has required headers
        
        Args:
            data: Parsed CSV data
            required_headers: List of required header names
            
        Returns:
            Tuple of (is_valid, missing_headers)
        """
        if not data:
            return False, required_headers
        
        actual_headers = set(data[0].keys())
        missing = [h for h in required_headers if h not in actual_headers]
        
        return len(missing) == 0, missing


class DataMergeStrategy:
    """Strategies for merging imported data with existing records"""
    
    SKIP = 'skip'  # Skip existing records
    UPDATE = 'update'  # Update existing records
    ERROR = 'error'  # Raise error on duplicates
    
    @staticmethod
    def should_update(strategy: str, existing_record, new_data: Dict[str, Any]) -> bool:
        """
        Determine if existing record should be updated
        
        Args:
            strategy: Merge strategy (skip, update, error)
            existing_record: Existing database record
            new_data: New data to import
            
        Returns:
            True if record should be updated
        """
        if strategy == DataMergeStrategy.SKIP:
            return False
        elif strategy == DataMergeStrategy.UPDATE:
            return True
        elif strategy == DataMergeStrategy.ERROR:
            raise ValidationError(f"Duplicate record found: {existing_record}")
        return False
