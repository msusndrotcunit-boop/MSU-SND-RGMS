"""
Test script for Task 22: PDF generation and reporting.
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.cadets.models import Cadet, Grades
from apps.attendance.models import TrainingDay, AttendanceRecord
from apps.activities.models import Activity
from apps.reports.generators import (
    CadetProfilePDFGenerator,
    GradeReportPDFGenerator,
    AttendanceReportPDFGenerator,
    CertificatePDFGenerator
)
from datetime import date, timedelta


def test_pdf_generators():
    """Test PDF generation utilities."""
    print("\n=== Testing PDF Generation Utilities ===\n")
    
    # Test 1: Cadet Profile PDF
    print("Test 1: Cadet Profile PDF Generation")
    try:
        # Create a test cadet
        cadet = Cadet.objects.create(
            student_id='TEST-PDF-001',
            first_name='John',
            last_name='Doe',
            middle_name='Test',
            company='Alpha',
            platoon='1',
            course='Computer Science',
            year_level=3,
            status='Ongoing',
            email='john.doe@test.com',
            contact_number='09123456789',
            birthdate=date(2000, 1, 1),
            birthplace='Test City',
            age=24,
            gender='Male',
            blood_type='O+',
            civil_status='Single',
            nationality='Filipino',
            address='123 Test St, Test City'
        )
        
        # Create grades
        grades = Grades.objects.create(
            cadet=cadet,
            attendance_present=20,
            merit_points=50,
            demerit_points=5,
            prelim_score=85.5,
            midterm_score=88.0,
            final_score=90.5
        )
        
        # Generate PDF
        generator = CadetProfilePDFGenerator()
        pdf_buffer = generator.generate(cadet)
        
        # Save to file for inspection
        with open('test_cadet_profile.pdf', 'wb') as f:
            f.write(pdf_buffer.getvalue())
        
        print("✓ Cadet profile PDF generated successfully")
        print(f"  - PDF size: {len(pdf_buffer.getvalue())} bytes")
        print(f"  - Saved to: test_cadet_profile.pdf")
        
    except Exception as e:
        print(f"✗ Error generating cadet profile PDF: {e}")
        import traceback
        traceback.print_exc()
    
    # Test 2: Grade Report PDF
    print("\nTest 2: Grade Report PDF Generation")
    try:
        # Create additional test cadets
        cadets = []
        for i in range(3):
            c = Cadet.objects.create(
                student_id=f'TEST-PDF-{100+i}',
                first_name=f'Cadet{i}',
                last_name=f'Test{i}',
                company='Bravo',
                platoon='2',
                course='Engineering',
                year_level=2,
                status='Ongoing'
            )
            Grades.objects.create(
                cadet=c,
                attendance_present=15 + i,
                merit_points=40 + i*5,
                demerit_points=2 + i,
                prelim_score=80.0 + i,
                midterm_score=82.0 + i,
                final_score=85.0 + i
            )
            cadets.append(c)
        
        # Generate PDF
        all_cadets = Cadet.objects.select_related('grades').filter(
            student_id__startswith='TEST-PDF'
        )
        generator = GradeReportPDFGenerator()
        pdf_buffer = generator.generate(all_cadets, {'company': 'All', 'platoon': 'All'})
        
        # Save to file
        with open('test_grade_report.pdf', 'wb') as f:
            f.write(pdf_buffer.getvalue())
        
        print("✓ Grade report PDF generated successfully")
        print(f"  - PDF size: {len(pdf_buffer.getvalue())} bytes")
        print(f"  - Cadets included: {all_cadets.count()}")
        print(f"  - Saved to: test_grade_report.pdf")
        
    except Exception as e:
        print(f"✗ Error generating grade report PDF: {e}")
        import traceback
        traceback.print_exc()
    
    # Test 3: Attendance Report PDF
    print("\nTest 3: Attendance Report PDF Generation")
    try:
        # Create test training days
        training_days = []
        for i in range(3):
            td = TrainingDay.objects.create(
                date=date.today() - timedelta(days=i*7),
                title=f'Training Day {i+1}',
                description=f'Test training day {i+1}',
                location='Test Field'
            )
            
            # Create attendance records
            for cadet in Cadet.objects.filter(student_id__startswith='TEST-PDF')[:3]:
                AttendanceRecord.objects.create(
                    training_day=td,
                    cadet=cadet,
                    status='present' if i % 2 == 0 else 'absent'
                )
            
            training_days.append(td)
        
        # Generate PDF
        generator = AttendanceReportPDFGenerator()
        pdf_buffer = generator.generate(training_days, {
            'date_from': (date.today() - timedelta(days=30)).isoformat(),
            'date_to': date.today().isoformat()
        })
        
        # Save to file
        with open('test_attendance_report.pdf', 'wb') as f:
            f.write(pdf_buffer.getvalue())
        
        print("✓ Attendance report PDF generated successfully")
        print(f"  - PDF size: {len(pdf_buffer.getvalue())} bytes")
        print(f"  - Training days included: {len(training_days)}")
        print(f"  - Saved to: test_attendance_report.pdf")
        
    except Exception as e:
        print(f"✗ Error generating attendance report PDF: {e}")
        import traceback
        traceback.print_exc()
    
    # Test 4: Achievement Certificate PDF
    print("\nTest 4: Achievement Certificate PDF Generation")
    try:
        # Create test activity
        activity = Activity.objects.create(
            title='Outstanding Leadership Award',
            description='Awarded for exceptional leadership skills and dedication to the ROTC program.',
            date=date.today(),
            type='achievement'
        )
        
        # Generate PDF
        generator = CertificatePDFGenerator()
        pdf_buffer = generator.generate(activity, 'John Doe', 'CERT-TEST-12345')
        
        # Save to file
        with open('test_certificate.pdf', 'wb') as f:
            f.write(pdf_buffer.getvalue())
        
        print("✓ Achievement certificate PDF generated successfully")
        print(f"  - PDF size: {len(pdf_buffer.getvalue())} bytes")
        print(f"  - Activity: {activity.title}")
        print(f"  - Saved to: test_certificate.pdf")
        
    except Exception as e:
        print(f"✗ Error generating certificate PDF: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n=== PDF Generation Tests Complete ===\n")
    print("Generated PDF files:")
    print("  - test_cadet_profile.pdf")
    print("  - test_grade_report.pdf")
    print("  - test_attendance_report.pdf")
    print("  - test_certificate.pdf")
    print("\nYou can open these files to verify the PDF generation works correctly.")


def cleanup_test_data():
    """Clean up test data."""
    print("\n=== Cleaning up test data ===")
    
    # Delete test cadets (cascade will delete grades and attendance)
    deleted_cadets = Cadet.objects.filter(student_id__startswith='TEST-PDF').delete()
    print(f"Deleted {deleted_cadets[0]} test cadets")
    
    # Delete test training days
    deleted_training_days = TrainingDay.objects.filter(title__startswith='Training Day').delete()
    print(f"Deleted {deleted_training_days[0]} test training days")
    
    # Delete test activities
    deleted_activities = Activity.objects.filter(title__contains='Outstanding Leadership').delete()
    print(f"Deleted {deleted_activities[0]} test activities")
    
    print("Cleanup complete\n")


if __name__ == '__main__':
    try:
        test_pdf_generators()
        
        # Ask user if they want to clean up
        response = input("\nDo you want to clean up test data? (y/n): ")
        if response.lower() == 'y':
            cleanup_test_data()
        else:
            print("Test data preserved for inspection")
            
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
