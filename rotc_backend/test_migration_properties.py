#!/usr/bin/env python3
"""
Property-based tests for data migration.
Tests that verify data migration preserves all data integrity.

**Validates: Requirements 23.3, 23.6, 23.7, 23.8**

Usage:
    python -m pytest test_migration_properties.py -v
    python -m pytest test_migration_properties.py::test_data_migration_preservation -v
"""

import os
import sys
import json
import pytest
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from hypothesis import given, strategies as st, settings, assume
from hypothesis.strategies import composite

# Add Django project to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from django.test import TestCase
from django.db import transaction
from apps.authentication.models import User, UserSettings
from apps.cadets.models import Cadet, Grades
from apps.grading.models import MeritDemeritLog
from apps.staff.models import TrainingStaff
from apps.attendance.models import TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter
from apps.activities.models import Activity, ActivityImage
from apps.messaging.models import AdminMessage, StaffMessage, Notification, PushSubscription
from apps.system.models import SystemSettings, AuditLog, SyncEvent


# Test data generators
@composite
def user_data(draw):
    """Generate user data for testing."""
    return {
        'id': draw(st.integers(min_value=1, max_value=10000)),
        'username': draw(st.text(min_size=3, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd')))),
        'email': draw(st.emails()),
        'password': draw(st.text(min_size=60, max_size=60).filter(lambda x: x.startswith('$2'))),  # bcrypt-like
        'role': draw(st.sampled_from(['admin', 'cadet', 'training_staff'])),
        'is_approved': draw(st.booleans()),
        'cadet_id': draw(st.one_of(st.none(), st.integers(min_value=1, max_value=1000))),
        'staff_id': draw(st.one_of(st.none(), st.integers(min_value=1, max_value=1000))),
        'profile_pic': draw(st.one_of(st.none(), st.text(min_size=10, max_size=200))),
        'created_at': draw(st.datetimes(min_value=datetime(2020, 1, 1), max_value=datetime(2024, 12, 31))).isoformat()
    }


@composite
def cadet_data(draw):
    """Generate cadet data for testing."""
    return {
        'id': draw(st.integers(min_value=1, max_value=10000)),
        'student_id': draw(st.text(min_size=5, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Nd')))),
        'first_name': draw(st.text(min_size=2, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll')))),
        'last_name': draw(st.text(min_size=2, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll')))),
        'middle_name': draw(st.one_of(st.none(), st.text(min_size=2, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll'))))),
        'company': draw(st.one_of(st.none(), st.sampled_from(['Alpha', 'Bravo', 'Charlie', 'Delta']))),
        'platoon': draw(st.one_of(st.none(), st.sampled_from(['1st', '2nd', '3rd', '4th']))),
        'status': draw(st.sampled_from(['Ongoing', 'Graduated', 'Dropped', 'Transferred'])),
        'profile_pic': draw(st.one_of(st.none(), st.text(min_size=10, max_size=200))),
        'is_archived': draw(st.booleans()),
        'created_at': draw(st.datetimes(min_value=datetime(2020, 1, 1), max_value=datetime(2024, 12, 31))).isoformat()
    }


@composite
def grades_data(draw):
    """Generate grades data for testing."""
    return {
        'id': draw(st.integers(min_value=1, max_value=10000)),
        'cadet_id': draw(st.integers(min_value=1, max_value=1000)),
        'attendance_present': draw(st.integers(min_value=0, max_value=100)),
        'merit_points': draw(st.integers(min_value=0, max_value=500)),
        'demerit_points': draw(st.integers(min_value=0, max_value=500)),
        'prelim_score': draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=100.0))),
        'midterm_score': draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=100.0))),
        'final_score': draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=100.0)))
    }


@composite
def training_day_data(draw):
    """Generate training day data for testing."""
    return {
        'id': draw(st.integers(min_value=1, max_value=10000)),
        'date': draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2024, 12, 31))).isoformat(),
        'title': draw(st.text(min_size=5, max_size=100)),
        'description': draw(st.one_of(st.none(), st.text(min_size=10, max_size=500))),
        'location': draw(st.one_of(st.none(), st.text(min_size=5, max_size=100))),
        'created_at': draw(st.datetimes(min_value=datetime(2020, 1, 1), max_value=datetime(2024, 12, 31))).isoformat()
    }


class MigrationPropertyTests(TestCase):
    """Property-based tests for data migration."""
    
    def setUp(self):
        """Set up test environment."""
        self.test_data_dir = '/tmp/test_migration_data'
        os.makedirs(self.test_data_dir, exist_ok=True)
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)
    
    def create_test_json_file(self, table_name: str, data: List[Dict[str, Any]]):
        """Create test JSON file."""
        json_path = os.path.join(self.test_data_dir, f"{table_name}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)
    
    def import_test_data(self, table_name: str, model_class, data: List[Dict[str, Any]]):
        """Import test data into Django models."""
        from scripts.import_django_data import DataImporter
        
        # Create test JSON file
        self.create_test_json_file(table_name, data)
        
        # Import data
        importer = DataImporter(self.test_data_dir)
        
        if table_name == 'users':
            return importer.import_users(data)
        elif table_name == 'cadets':
            return importer.import_cadets(data)
        elif table_name == 'grades':
            return importer.import_grades(data)
        else:
            return importer.import_generic_model(table_name, model_class, data)
    
    @given(st.lists(user_data(), min_size=1, max_size=10))
    @settings(max_examples=10, deadline=30000)
    def test_user_data_migration_preservation(self, user_records):
        """
        **Property 34: Data Migration Preservation**
        
        For any record in the Legacy_Backend database, after migration to Django_Backend,
        the record SHALL exist with identical field values, preserving all data including
        timestamps, foreign key relationships, and Cloudinary URLs.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        # Ensure unique usernames and emails
        seen_usernames = set()
        seen_emails = set()
        unique_records = []
        
        for record in user_records:
            if record['username'] not in seen_usernames and record['email'] not in seen_emails:
                seen_usernames.add(record['username'])
                seen_emails.add(record['email'])
                unique_records.append(record)
        
        assume(len(unique_records) > 0)
        
        with transaction.atomic():
            # Import test data
            imported_count = self.import_test_data('users', User, unique_records)
            
            # Verify all records were imported
            assert imported_count == len(unique_records), f"Expected {len(unique_records)} records, imported {imported_count}"
            
            # Verify each record preserves all field values
            for original_record in unique_records:
                imported_user = User.objects.get(id=original_record['id'])
                
                # Verify core fields are preserved exactly
                assert imported_user.username == original_record['username']
                assert imported_user.email == original_record['email']
                assert imported_user.password == original_record['password']  # bcrypt hash preserved
                assert imported_user.role == original_record['role']
                assert imported_user.is_approved == original_record['is_approved']
                
                # Verify optional fields are preserved
                assert imported_user.cadet_id == original_record.get('cadet_id')
                assert imported_user.staff_id == original_record.get('staff_id')
                assert imported_user.profile_pic == original_record.get('profile_pic')
                
                # Verify timestamp preservation
                original_timestamp = datetime.fromisoformat(original_record['created_at'].replace('Z', '+00:00'))
                assert imported_user.created_at.replace(tzinfo=None) == original_timestamp.replace(tzinfo=None)
    
    @given(st.lists(cadet_data(), min_size=1, max_size=10))
    @settings(max_examples=10, deadline=30000)
    def test_cadet_data_migration_preservation(self, cadet_records):
        """
        **Property 34: Data Migration Preservation**
        
        For any cadet record, after migration all field values SHALL be preserved exactly,
        including student IDs, profile pictures, and timestamps.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        # Ensure unique student IDs
        seen_student_ids = set()
        unique_records = []
        
        for record in cadet_records:
            if record['student_id'] not in seen_student_ids:
                seen_student_ids.add(record['student_id'])
                unique_records.append(record)
        
        assume(len(unique_records) > 0)
        
        with transaction.atomic():
            # Import test data
            imported_count = self.import_test_data('cadets', Cadet, unique_records)
            
            # Verify all records were imported
            assert imported_count == len(unique_records)
            
            # Verify each record preserves all field values
            for original_record in unique_records:
                imported_cadet = Cadet.objects.get(id=original_record['id'])
                
                # Verify core fields are preserved exactly
                assert imported_cadet.student_id == original_record['student_id']
                assert imported_cadet.first_name == original_record['first_name']
                assert imported_cadet.last_name == original_record['last_name']
                assert imported_cadet.middle_name == original_record.get('middle_name')
                assert imported_cadet.company == original_record.get('company')
                assert imported_cadet.platoon == original_record.get('platoon')
                assert imported_cadet.status == original_record['status']
                assert imported_cadet.is_archived == original_record['is_archived']
                
                # Verify Cloudinary URLs are preserved
                assert imported_cadet.profile_pic == original_record.get('profile_pic')
                
                # Verify timestamp preservation
                original_timestamp = datetime.fromisoformat(original_record['created_at'].replace('Z', '+00:00'))
                assert imported_cadet.created_at.replace(tzinfo=None) == original_timestamp.replace(tzinfo=None)
    
    @given(st.lists(grades_data(), min_size=1, max_size=10))
    @settings(max_examples=10, deadline=30000)
    def test_grades_data_migration_preservation(self, grades_records):
        """
        **Property 34: Data Migration Preservation**
        
        For any grades record, after migration all numeric values SHALL be preserved exactly,
        including attendance counts and merit/demerit points.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        # Create corresponding cadets first
        cadet_ids = list(set(record['cadet_id'] for record in grades_records))
        cadets_data = []
        
        for cadet_id in cadet_ids:
            cadets_data.append({
                'id': cadet_id,
                'student_id': f'TEST{cadet_id:04d}',
                'first_name': 'Test',
                'last_name': f'Cadet{cadet_id}',
                'status': 'Ongoing',
                'is_archived': False,
                'created_at': datetime.now().isoformat()
            })
        
        with transaction.atomic():
            # Import cadets first
            self.import_test_data('cadets', Cadet, cadets_data)
            
            # Import grades
            imported_count = self.import_test_data('grades', Grades, grades_records)
            
            # Verify all records were imported
            assert imported_count == len(grades_records)
            
            # Verify each record preserves all field values
            for original_record in grades_records:
                imported_grades = Grades.objects.get(id=original_record['id'])
                
                # Verify all numeric fields are preserved exactly
                assert imported_grades.cadet_id == original_record['cadet_id']
                assert imported_grades.attendance_present == original_record['attendance_present']
                assert imported_grades.merit_points == original_record['merit_points']
                assert imported_grades.demerit_points == original_record['demerit_points']
                
                # Verify optional score fields
                if original_record.get('prelim_score') is not None:
                    assert abs(imported_grades.prelim_score - original_record['prelim_score']) < 0.001
                else:
                    assert imported_grades.prelim_score is None
                
                if original_record.get('midterm_score') is not None:
                    assert abs(imported_grades.midterm_score - original_record['midterm_score']) < 0.001
                else:
                    assert imported_grades.midterm_score is None
                
                if original_record.get('final_score') is not None:
                    assert abs(imported_grades.final_score - original_record['final_score']) < 0.001
                else:
                    assert imported_grades.final_score is None
    
    @given(st.lists(training_day_data(), min_size=1, max_size=10))
    @settings(max_examples=10, deadline=30000)
    def test_training_day_data_migration_preservation(self, training_day_records):
        """
        **Property 34: Data Migration Preservation**
        
        For any training day record, after migration all field values SHALL be preserved exactly,
        including dates and timestamps.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        with transaction.atomic():
            # Import test data
            imported_count = self.import_test_data('training_days', TrainingDay, training_day_records)
            
            # Verify all records were imported
            assert imported_count == len(training_day_records)
            
            # Verify each record preserves all field values
            for original_record in training_day_records:
                imported_training_day = TrainingDay.objects.get(id=original_record['id'])
                
                # Verify core fields are preserved exactly
                assert imported_training_day.title == original_record['title']
                assert imported_training_day.description == original_record.get('description')
                assert imported_training_day.location == original_record.get('location')
                
                # Verify date preservation
                original_date = date.fromisoformat(original_record['date'])
                assert imported_training_day.date == original_date
                
                # Verify timestamp preservation
                original_timestamp = datetime.fromisoformat(original_record['created_at'].replace('Z', '+00:00'))
                assert imported_training_day.created_at.replace(tzinfo=None) == original_timestamp.replace(tzinfo=None)
    
    def test_foreign_key_relationships_preserved(self):
        """
        **Property 34: Data Migration Preservation**
        
        For any record with foreign key relationships, after migration the relationships
        SHALL be preserved exactly.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        with transaction.atomic():
            # Create test data with foreign key relationships
            user_data = {
                'id': 1,
                'username': 'testuser',
                'email': 'test@example.com',
                'password': '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ',
                'role': 'cadet',
                'is_approved': True,
                'cadet_id': 1,
                'created_at': datetime.now().isoformat()
            }
            
            cadet_data = {
                'id': 1,
                'student_id': 'TEST001',
                'first_name': 'Test',
                'last_name': 'Cadet',
                'status': 'Ongoing',
                'is_archived': False,
                'created_at': datetime.now().isoformat()
            }
            
            grades_data = {
                'id': 1,
                'cadet_id': 1,
                'attendance_present': 10,
                'merit_points': 50,
                'demerit_points': 5
            }
            
            # Import in dependency order
            self.import_test_data('users', User, [user_data])
            self.import_test_data('cadets', Cadet, [cadet_data])
            self.import_test_data('grades', Grades, [grades_data])
            
            # Verify relationships are preserved
            imported_user = User.objects.get(id=1)
            imported_cadet = Cadet.objects.get(id=1)
            imported_grades = Grades.objects.get(id=1)
            
            # Verify foreign key relationships
            assert imported_user.cadet_id == imported_cadet.id
            assert imported_grades.cadet_id == imported_cadet.id
            assert imported_grades.cadet == imported_cadet
    
    def test_cloudinary_urls_preserved(self):
        """
        **Property 34: Data Migration Preservation**
        
        For any record with Cloudinary URLs, after migration the URLs SHALL be preserved
        exactly without modification.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        cloudinary_url = "https://res.cloudinary.com/test-cloud/image/upload/v1234567890/profile_pics/test_image.jpg"
        
        with transaction.atomic():
            # Create test data with Cloudinary URLs
            user_data = {
                'id': 1,
                'username': 'testuser',
                'email': 'test@example.com',
                'password': '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ',
                'role': 'admin',
                'is_approved': True,
                'profile_pic': cloudinary_url,
                'created_at': datetime.now().isoformat()
            }
            
            cadet_data = {
                'id': 1,
                'student_id': 'TEST001',
                'first_name': 'Test',
                'last_name': 'Cadet',
                'status': 'Ongoing',
                'profile_pic': cloudinary_url,
                'is_archived': False,
                'created_at': datetime.now().isoformat()
            }
            
            # Import data
            self.import_test_data('users', User, [user_data])
            self.import_test_data('cadets', Cadet, [cadet_data])
            
            # Verify Cloudinary URLs are preserved exactly
            imported_user = User.objects.get(id=1)
            imported_cadet = Cadet.objects.get(id=1)
            
            assert imported_user.profile_pic == cloudinary_url
            assert imported_cadet.profile_pic == cloudinary_url
    
    def test_bcrypt_hashes_preserved(self):
        """
        **Property 34: Data Migration Preservation**
        
        For any user record with bcrypt password hash, after migration the hash SHALL be
        preserved exactly to maintain authentication compatibility.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        bcrypt_hash = "$2b$10$N9qo8uLOickgx2ZMRZoMye.IjPeGvGzjYwSgjkMIUrC6U/mi6NEm."
        
        with transaction.atomic():
            # Create test data with bcrypt hash
            user_data = {
                'id': 1,
                'username': 'testuser',
                'email': 'test@example.com',
                'password': bcrypt_hash,
                'role': 'admin',
                'is_approved': True,
                'created_at': datetime.now().isoformat()
            }
            
            # Import data
            self.import_test_data('users', User, [user_data])
            
            # Verify bcrypt hash is preserved exactly
            imported_user = User.objects.get(id=1)
            assert imported_user.password == bcrypt_hash
    
    def test_timestamp_precision_preserved(self):
        """
        **Property 34: Data Migration Preservation**
        
        For any record with timestamps, after migration the timestamp precision SHALL be
        preserved to maintain exact temporal data.
        
        **Validates: Requirements 23.3, 23.6, 23.7, 23.8**
        """
        # Test with microsecond precision
        precise_timestamp = "2024-01-15T10:30:45.123456Z"
        
        with transaction.atomic():
            # Create test data with precise timestamp
            user_data = {
                'id': 1,
                'username': 'testuser',
                'email': 'test@example.com',
                'password': '$2b$10$test',
                'role': 'admin',
                'is_approved': True,
                'created_at': precise_timestamp
            }
            
            # Import data
            self.import_test_data('users', User, [user_data])
            
            # Verify timestamp precision is preserved
            imported_user = User.objects.get(id=1)
            original_dt = datetime.fromisoformat(precise_timestamp.replace('Z', '+00:00'))
            imported_dt = imported_user.created_at.replace(tzinfo=None)
            
            # Allow for small differences due to database precision
            time_diff = abs((imported_dt - original_dt.replace(tzinfo=None)).total_seconds())
            assert time_diff < 0.001  # Less than 1 millisecond difference


if __name__ == '__main__':
    pytest.main([__file__, '-v'])