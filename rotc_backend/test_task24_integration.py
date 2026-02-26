"""
Test suite for Task 24: Data import/export and ROTCMIS integration

This test file validates:
- Import/export utilities (CSV and Excel)
- ROTCMIS import endpoint with validation
- Import status tracking and error reporting
- Excel and CSV export endpoints with filtering
- Bulk update via CSV import
- Import/export audit logging
- Data preservation during imports (merge strategies)
"""
import os
import sys
import django

# Set up Django before importing models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

import json
import io
from datetime import datetime, date
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.cache import cache
from unittest.mock import patch, MagicMock

from apps.cadets.models import Cadet, Grades
from apps.grading.models import MeritDemeritLog
from apps.attendance.models import TrainingDay, AttendanceRecord
from apps.activities.models import Activity
from apps.system.models import AuditLog
from apps.integration.importers import (
    ROTCMISImporter, CSVImporter, ImportResult, DataMergeStrategy
)
from apps.integration.exporters import CSVExporter, ExcelExporter

User = get_user_model()


class ImportExportUtilitiesTest(TestCase):
    """Test import/export utility classes"""
    
    def test_csv_exporter_basic(self):
        """Test CSV export with basic data"""
        data = [
            {'id': 1, 'name': 'John Doe', 'email': 'john@example.com'},
            {'id': 2, 'name': 'Jane Smith', 'email': 'jane@example.com'}
        ]
        
        csv_string = CSVExporter.export_to_string(data)
        
        self.assertIn('id,name,email', csv_string)
        self.assertIn('John Doe', csv_string)
        self.assertIn('Jane Smith', csv_string)
    
    def test_csv_exporter_empty_data(self):
        """Test CSV export with empty data"""
        csv_string = CSVExporter.export_to_string([])
        self.assertEqual(csv_string, "")
    
    def test_excel_exporter_basic(self):
        """Test Excel export with basic data"""
        data = [
            {'id': 1, 'name': 'John Doe', 'score': 95.5},
            {'id': 2, 'name': 'Jane Smith', 'score': 87.3}
        ]
        
        wb = ExcelExporter.create_workbook(data, sheet_name="Test")
        ws = wb.active
        
        # Check headers
        self.assertEqual(ws.cell(1, 1).value, 'id')
        self.assertEqual(ws.cell(1, 2).value, 'name')
        self.assertEqual(ws.cell(1, 3).value, 'score')
        
        # Check data
        self.assertEqual(ws.cell(2, 1).value, 1)
        self.assertEqual(ws.cell(2, 2).value, 'John Doe')
        self.assertEqual(ws.cell(2, 3).value, 95.5)
    
    def test_excel_exporter_multi_sheet(self):
        """Test Excel export with multiple sheets"""
        sheets = {
            'Sheet1': [{'id': 1, 'name': 'Test1'}],
            'Sheet2': [{'id': 2, 'name': 'Test2'}]
        }
        
        wb = ExcelExporter.create_multi_sheet_workbook(sheets)
        
        self.assertEqual(len(wb.sheetnames), 2)
        self.assertIn('Sheet1', wb.sheetnames)
        self.assertIn('Sheet2', wb.sheetnames)


class ROTCMISImporterTest(TestCase):
    """Test ROTCMIS data import functionality"""
    
    def test_validate_cadet_data_valid(self):
        """Test validation with valid cadet data"""
        data = {
            'student_id': '2021-12345',
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'john@example.com',
            'year_level': 3
        }
        
        is_valid, errors = ROTCMISImporter.validate_cadet_data(data)
        
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
    
    def test_validate_cadet_data_missing_required(self):
        """Test validation with missing required fields"""
        data = {
            'first_name': 'John'
            # Missing student_id and last_name
        }
        
        is_valid, errors = ROTCMISImporter.validate_cadet_data(data)
        
        self.assertFalse(is_valid)
        self.assertGreater(len(errors), 0)
        self.assertTrue(any('student_id' in err for err in errors))
    
    def test_validate_cadet_data_invalid_email(self):
        """Test validation with invalid email"""
        data = {
            'student_id': '2021-12345',
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'invalid-email'
        }
        
        is_valid, errors = ROTCMISImporter.validate_cadet_data(data)
        
        self.assertFalse(is_valid)
        self.assertTrue(any('email' in err for err in errors))
    
    def test_normalize_cadet_data(self):
        """Test data normalization from ROTCMIS format"""
        data = {
            'studentId': '2021-12345',  # camelCase
            'firstName': 'John',
            'lastName': 'Doe',
            'yearLevel': 3,
            'company': 'Alpha'
        }
        
        normalized = ROTCMISImporter.normalize_cadet_data(data)
        
        self.assertEqual(normalized['student_id'], '2021-12345')
        self.assertEqual(normalized['first_name'], 'John')
        self.assertEqual(normalized['last_name'], 'Doe')
        self.assertEqual(normalized['year_level'], 3)
        self.assertEqual(normalized['status'], 'Ongoing')  # Default value


class CSVImporterTest(TestCase):
    """Test CSV import functionality"""
    
    def test_parse_csv_basic(self):
        """Test parsing basic CSV content"""
        csv_content = "id,name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com"
        
        data = CSVImporter.parse_csv(csv_content)
        
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['name'], 'John Doe')
        self.assertEqual(data[1]['email'], 'jane@example.com')
    
    def test_validate_headers_valid(self):
        """Test header validation with valid headers"""
        data = [
            {'student_id': '123', 'first_name': 'John', 'last_name': 'Doe'}
        ]
        required = ['student_id', 'first_name', 'last_name']
        
        is_valid, missing = CSVImporter.validate_headers(data, required)
        
        self.assertTrue(is_valid)
        self.assertEqual(len(missing), 0)
    
    def test_validate_headers_missing(self):
        """Test header validation with missing headers"""
        data = [
            {'student_id': '123', 'first_name': 'John'}
        ]
        required = ['student_id', 'first_name', 'last_name']
        
        is_valid, missing = CSVImporter.validate_headers(data, required)
        
        self.assertFalse(is_valid)
        self.assertIn('last_name', missing)


class ImportResultTest(TestCase):
    """Test ImportResult container class"""
    
    def test_import_result_tracking(self):
        """Test tracking import results"""
        result = ImportResult()
        
        result.add_success(1, created=True)
        result.add_success(2, created=False)
        result.add_error(3, 'field', 'error message')
        result.add_warning('warning message')
        
        self.assertEqual(result.success_count, 2)
        self.assertEqual(result.error_count, 1)
        self.assertEqual(len(result.created_ids), 1)
        self.assertEqual(len(result.updated_ids), 1)
        self.assertEqual(len(result.warnings), 1)
    
    def test_import_result_to_dict(self):
        """Test converting result to dictionary"""
        result = ImportResult()
        result.add_success(1, created=True)
        result.add_error(2, 'field', 'error')
        
        result_dict = result.to_dict()
        
        self.assertIn('success_count', result_dict)
        self.assertIn('error_count', result_dict)
        self.assertIn('total_processed', result_dict)
        self.assertEqual(result_dict['total_processed'], 2)


class ROTCMISImportEndpointTest(TestCase):
    """Test ROTCMIS import API endpoint"""
    
    def setUp(self):
        """Set up test client and admin user"""
        self.client = Client()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='admin',
            is_approved=True
        )
        self.client.force_login(self.admin_user)
    
    def test_import_rotcmis_sync_success(self):
        """Test synchronous ROTCMIS import with valid data"""
        data = {
            'data': [
                {
                    'student_id': '2021-12345',
                    'first_name': 'John',
                    'last_name': 'Doe',
                    'company': 'Alpha',
                    'platoon': '1st'
                }
            ],
            'merge_strategy': 'skip',
            'async_processing': False
        }
        
        response = self.client.post(
            '/api/import/rotcmis',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['success_count'], 1)
        self.assertEqual(result['error_count'], 0)
        
        # Verify cadet was created
        cadet = Cadet.objects.get(student_id='2021-12345')
        self.assertEqual(cadet.first_name, 'John')
        self.assertEqual(cadet.last_name, 'Doe')
        
        # Verify grades record was created
        self.assertTrue(hasattr(cadet, 'grades'))
    
    def test_import_rotcmis_validation_errors(self):
        """Test import with validation errors"""
        data = {
            'data': [
                {
                    'first_name': 'John'
                    # Missing required fields
                }
            ],
            'merge_strategy': 'skip',
            'async_processing': False
        }
        
        response = self.client.post(
            '/api/import/rotcmis',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['success_count'], 0)
        self.assertGreater(result['error_count'], 0)
        self.assertGreater(len(result['errors']), 0)
    
    @patch('apps.integration.views.import_rotcmis_data.delay')
    def test_import_rotcmis_async(self, mock_delay):
        """Test asynchronous ROTCMIS import"""
        mock_task = MagicMock()
        mock_task.id = 'test-task-id-123'
        mock_delay.return_value = mock_task
        
        data = {
            'data': [{'student_id': f'2021-{i:05d}', 'first_name': f'Student{i}', 'last_name': 'Test'} 
                     for i in range(100)],  # Large dataset
            'merge_strategy': 'skip',
            'async_processing': True
        }
        
        response = self.client.post(
            '/api/import/rotcmis',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 202)
        result = response.json()
        self.assertIn('task_id', result)
        self.assertEqual(result['status'], 'processing')
        
        # Verify Celery task was called
        mock_delay.assert_called_once()
    
    def test_import_rotcmis_merge_strategy_skip(self):
        """Test import with skip merge strategy"""
        # Create existing cadet
        Cadet.objects.create(
            student_id='2021-12345',
            first_name='Original',
            last_name='Name'
        )
        
        data = {
            'data': [
                {
                    'student_id': '2021-12345',
                    'first_name': 'Updated',
                    'last_name': 'Name'
                }
            ],
            'merge_strategy': 'skip',
            'async_processing': False
        }
        
        response = self.client.post(
            '/api/import/rotcmis',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        
        # Verify original data was not changed
        cadet = Cadet.objects.get(student_id='2021-12345')
        self.assertEqual(cadet.first_name, 'Original')
    
    def test_import_rotcmis_merge_strategy_update(self):
        """Test import with update merge strategy"""
        # Create existing cadet
        Cadet.objects.create(
            student_id='2021-12345',
            first_name='Original',
            last_name='Name'
        )
        
        data = {
            'data': [
                {
                    'student_id': '2021-12345',
                    'first_name': 'Updated',
                    'last_name': 'Name'
                }
            ],
            'merge_strategy': 'update',
            'async_processing': False
        }
        
        response = self.client.post(
            '/api/import/rotcmis',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        
        # Verify data was updated
        cadet = Cadet.objects.get(student_id='2021-12345')
        self.assertEqual(cadet.first_name, 'Updated')
    
    def test_import_rotcmis_audit_logging(self):
        """Test that import operations are logged"""
        data = {
            'data': [
                {
                    'student_id': '2021-12345',
                    'first_name': 'John',
                    'last_name': 'Doe'
                }
            ],
            'merge_strategy': 'skip',
            'async_processing': False
        }
        
        response = self.client.post(
            '/api/import/rotcmis',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify audit log was created
        audit_logs = AuditLog.objects.filter(
            table_name='cadets',
            operation='BULK_IMPORT',
            user_id=self.admin_user.id
        )
        self.assertEqual(audit_logs.count(), 1)


class ImportStatusEndpointTest(TestCase):
    """Test import status tracking endpoint"""
    
    def setUp(self):
        """Set up test client and admin user"""
        self.client = Client()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='admin',
            is_approved=True
        )
        self.client.force_login(self.admin_user)
    
    def test_import_status_found(self):
        """Test retrieving import status from cache"""
        task_id = 'test-task-123'
        cache.set(f'import_task_{task_id}', {
            'status': 'processing',
            'progress': 50,
            'total': 100,
            'success_count': 45,
            'error_count': 5
        }, timeout=3600)
        
        response = self.client.get(f'/api/import/status/{task_id}')
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['status'], 'processing')
        self.assertEqual(result['progress'], 50)
        self.assertEqual(result['total'], 100)
    
    def test_import_status_not_found(self):
        """Test retrieving non-existent import status"""
        response = self.client.get('/api/import/status/nonexistent-task')
        
        self.assertEqual(response.status_code, 404)


class ExportEndpointsTest(TestCase):
    """Test Excel and CSV export endpoints"""
    
    def setUp(self):
        """Set up test data and admin user"""
        self.client = Client()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='admin',
            is_approved=True
        )
        self.client.force_login(self.admin_user)
        
        # Create test cadets
        for i in range(5):
            Cadet.objects.create(
                student_id=f'2021-{i:05d}',
                first_name=f'Student{i}',
                last_name='Test',
                company='Alpha',
                platoon='1st'
            )
    
    def test_export_excel_cadets(self):
        """Test Excel export of cadets"""
        response = self.client.get('/api/export/excel?entity_type=cadets')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertIn('attachment', response['Content-Disposition'])
    
    def test_export_csv_cadets(self):
        """Test CSV export of cadets"""
        response = self.client.get('/api/export/csv?entity_type=cadets')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment', response['Content-Disposition'])
        
        # Verify CSV content
        content = response.content.decode('utf-8')
        self.assertIn('student_id', content)
        self.assertIn('first_name', content)
    
    def test_export_with_filters(self):
        """Test export with filtering"""
        response = self.client.get('/api/export/csv?entity_type=cadets&company=Alpha')
        
        self.assertEqual(response.status_code, 200)
        
        # All exported cadets should be from Alpha company
        content = response.content.decode('utf-8')
        self.assertIn('Alpha', content)
    
    def test_export_audit_logging(self):
        """Test that export operations are logged"""
        response = self.client.get('/api/export/csv?entity_type=cadets')
        
        self.assertEqual(response.status_code, 200)
        
        # Verify audit log was created
        audit_logs = AuditLog.objects.filter(
            table_name='cadets',
            operation='EXPORT',
            user_id=self.admin_user.id
        )
        self.assertEqual(audit_logs.count(), 1)


class CSVImportEndpointTest(TestCase):
    """Test CSV bulk import endpoint"""
    
    def setUp(self):
        """Set up test client and admin user"""
        self.client = Client()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='admin',
            is_approved=True
        )
        self.client.force_login(self.admin_user)
    
    def test_csv_import_cadets(self):
        """Test importing cadets from CSV"""
        csv_content = "student_id,first_name,last_name,company,platoon\n"
        csv_content += "2021-12345,John,Doe,Alpha,1st\n"
        csv_content += "2021-12346,Jane,Smith,Bravo,2nd\n"
        
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'cadets.csv'
        
        response = self.client.post(
            '/api/import/csv',
            {
                'file': csv_file,
                'entity_type': 'cadets',
                'merge_strategy': 'skip'
            }
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['success_count'], 2)
        
        # Verify cadets were created
        self.assertEqual(Cadet.objects.count(), 2)
        self.assertTrue(Cadet.objects.filter(student_id='2021-12345').exists())
    
    def test_csv_import_with_update(self):
        """Test CSV import with update merge strategy"""
        # Create existing cadet
        Cadet.objects.create(
            student_id='2021-12345',
            first_name='Original',
            last_name='Name',
            company='Alpha'
        )
        
        csv_content = "student_id,first_name,last_name,company\n"
        csv_content += "2021-12345,Updated,Name,Bravo\n"
        
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'cadets.csv'
        
        response = self.client.post(
            '/api/import/csv',
            {
                'file': csv_file,
                'entity_type': 'cadets',
                'merge_strategy': 'update'
            }
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify cadet was updated
        cadet = Cadet.objects.get(student_id='2021-12345')
        self.assertEqual(cadet.first_name, 'Updated')
        self.assertEqual(cadet.company, 'Bravo')


class DataMergeStrategyTest(TestCase):
    """Test data merge strategies"""
    
    def test_merge_strategy_skip(self):
        """Test skip merge strategy"""
        existing = MagicMock()
        new_data = {'field': 'value'}
        
        should_update = DataMergeStrategy.should_update(
            DataMergeStrategy.SKIP,
            existing,
            new_data
        )
        
        self.assertFalse(should_update)
    
    def test_merge_strategy_update(self):
        """Test update merge strategy"""
        existing = MagicMock()
        new_data = {'field': 'value'}
        
        should_update = DataMergeStrategy.should_update(
            DataMergeStrategy.UPDATE,
            existing,
            new_data
        )
        
        self.assertTrue(should_update)


def run_tests():
    """Run all tests and print results"""
    from django.test.runner import DiscoverRunner
    
    runner = DiscoverRunner(verbosity=2, interactive=False, keepdb=False)
    failures = runner.run_tests(['__main__'])
    
    if failures:
        sys.exit(1)
    else:
        print("\n" + "="*70)
        print("All Task 24 tests passed successfully!")
        print("="*70)


if __name__ == '__main__':
    run_tests()
