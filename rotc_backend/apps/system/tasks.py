"""
Celery tasks for system operations.
"""
import logging
from celery import shared_task
from .sync_processor import process_sync_events, cleanup_old_sync_events

logger = logging.getLogger(__name__)


@shared_task(name='process_sync_events')
def process_sync_events_task():
    """
    Celery task to process unprocessed sync events.
    Should be run periodically (e.g., every 10 seconds).
    """
    try:
        count = process_sync_events(batch_size=100)
        return f"Processed {count} sync events"
    except Exception as e:
        logger.error(f"Error in process_sync_events_task: {e}")
        raise


@shared_task(name='cleanup_old_sync_events')
def cleanup_old_sync_events_task():
    """
    Celery task to clean up old processed sync events.
    Should be run periodically (e.g., daily).
    """
    try:
        count = cleanup_old_sync_events(days=7)
        return f"Cleaned up {count} old sync events"
    except Exception as e:
        logger.error(f"Error in cleanup_old_sync_events_task: {e}")
        raise


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_pdf_report(self, report_type, filters, user_id):
    """
    Generate a PDF report based on the report type and filters.
    
    Args:
        report_type: Type of report (cadet_profile, grades, attendance, certificate)
        filters: Dictionary of filters (cadet_id, date_range, company, platoon, etc.)
        user_id: ID of the user requesting the report
    
    Returns:
        dict: Report generation result with file URL
    """
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from django.core.files.base import ContentFile
    from django.utils import timezone
    import io
    import cloudinary.uploader
    
    try:
        logger.info(f"Generating {report_type} report for user {user_id}")
        
        # Create a buffer for the PDF
        buffer = io.BytesIO()
        
        # Create the PDF document
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title style
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        # Generate report based on type
        if report_type == 'cadet_profile':
            from apps.cadets.models import Cadet
            cadet_id = filters.get('cadet_id')
            cadet = Cadet.objects.select_related('grades').get(id=cadet_id)
            
            # Title
            elements.append(Paragraph(f"Cadet Profile Report", title_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Cadet information table
            data = [
                ['Student ID:', cadet.student_id],
                ['Name:', f"{cadet.first_name} {cadet.middle_name or ''} {cadet.last_name}"],
                ['Company:', cadet.company or 'N/A'],
                ['Platoon:', cadet.platoon or 'N/A'],
                ['Course:', cadet.course or 'N/A'],
                ['Year Level:', str(cadet.year_level) if cadet.year_level else 'N/A'],
                ['Status:', cadet.status],
            ]
            
            table = Table(data, colWidths=[2*inch, 4*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.grey),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('BACKGROUND', (1, 0), (1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(table)
            elements.append(Spacer(1, 0.3*inch))
            
            # Grades information
            if hasattr(cadet, 'grades'):
                elements.append(Paragraph("Academic Performance", styles['Heading2']))
                elements.append(Spacer(1, 0.1*inch))
                
                grades_data = [
                    ['Metric', 'Value'],
                    ['Attendance Present', str(cadet.grades.attendance_present)],
                    ['Merit Points', str(cadet.grades.merit_points)],
                    ['Demerit Points', str(cadet.grades.demerit_points)],
                    ['Prelim Score', str(cadet.grades.prelim_score or 'N/A')],
                    ['Midterm Score', str(cadet.grades.midterm_score or 'N/A')],
                    ['Final Score', str(cadet.grades.final_score or 'N/A')],
                ]
                
                grades_table = Table(grades_data, colWidths=[3*inch, 3*inch])
                grades_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                elements.append(grades_table)
        
        elif report_type == 'grades':
            from apps.cadets.models import Cadet
            
            # Title
            elements.append(Paragraph("Grades Report", title_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Apply filters
            queryset = Cadet.objects.select_related('grades').filter(is_archived=False)
            if filters.get('company'):
                queryset = queryset.filter(company=filters['company'])
            if filters.get('platoon'):
                queryset = queryset.filter(platoon=filters['platoon'])
            
            # Create grades table
            data = [['Student ID', 'Name', 'Attendance', 'Merit', 'Demerit', 'Prelim', 'Midterm', 'Final']]
            
            for cadet in queryset[:50]:  # Limit to 50 for performance
                if hasattr(cadet, 'grades'):
                    data.append([
                        cadet.student_id,
                        f"{cadet.first_name} {cadet.last_name}",
                        str(cadet.grades.attendance_present),
                        str(cadet.grades.merit_points),
                        str(cadet.grades.demerit_points),
                        str(cadet.grades.prelim_score or '-'),
                        str(cadet.grades.midterm_score or '-'),
                        str(cadet.grades.final_score or '-'),
                    ])
            
            table = Table(data, colWidths=[1*inch, 1.5*inch, 0.8*inch, 0.6*inch, 0.7*inch, 0.6*inch, 0.7*inch, 0.6*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(table)
        
        elif report_type == 'attendance':
            from apps.attendance.models import TrainingDay, AttendanceRecord
            from django.db.models import Count, Q
            
            # Title
            elements.append(Paragraph("Attendance Report", title_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Get training days
            queryset = TrainingDay.objects.all()
            if filters.get('date_from'):
                queryset = queryset.filter(date__gte=filters['date_from'])
            if filters.get('date_to'):
                queryset = queryset.filter(date__lte=filters['date_to'])
            
            # Create attendance summary table
            data = [['Date', 'Title', 'Present', 'Absent', 'Late', 'Excused', 'Total']]
            
            for training_day in queryset[:30]:  # Limit to 30 days
                attendance_stats = AttendanceRecord.objects.filter(training_day=training_day).aggregate(
                    present=Count('id', filter=Q(status='present')),
                    absent=Count('id', filter=Q(status='absent')),
                    late=Count('id', filter=Q(status='late')),
                    excused=Count('id', filter=Q(status='excused')),
                    total=Count('id')
                )
                
                data.append([
                    training_day.date.strftime('%Y-%m-%d'),
                    training_day.title[:30],
                    str(attendance_stats['present']),
                    str(attendance_stats['absent']),
                    str(attendance_stats['late']),
                    str(attendance_stats['excused']),
                    str(attendance_stats['total']),
                ])
            
            table = Table(data, colWidths=[1*inch, 2*inch, 0.8*inch, 0.8*inch, 0.6*inch, 0.8*inch, 0.7*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(table)
        
        elif report_type == 'certificate':
            from apps.activities.models import Activity
            activity_id = filters.get('activity_id')
            activity = Activity.objects.get(id=activity_id)
            cadet_name = filters.get('cadet_name', 'Cadet Name')
            
            # Certificate title
            elements.append(Spacer(1, 1*inch))
            elements.append(Paragraph("CERTIFICATE OF ACHIEVEMENT", title_style))
            elements.append(Spacer(1, 0.5*inch))
            
            # Certificate body
            cert_text = f"""
            <para align=center>
            This is to certify that<br/>
            <b><font size=18>{cadet_name}</font></b><br/>
            has successfully participated in<br/>
            <b><font size=14>{activity.title}</font></b><br/>
            held on {activity.date.strftime('%B %d, %Y')}<br/><br/>
            {activity.description[:200]}
            </para>
            """
            elements.append(Paragraph(cert_text, styles['Normal']))
            elements.append(Spacer(1, 1*inch))
            
            # Signature line
            sig_style = ParagraphStyle('Signature', parent=styles['Normal'], alignment=TA_CENTER)
            elements.append(Paragraph("_________________________", sig_style))
            elements.append(Paragraph("Authorized Signature", sig_style))
        
        # Add footer
        elements.append(Spacer(1, 0.5*inch))
        footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER)
        elements.append(Paragraph(f"Generated on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))
        
        # Build PDF
        doc.build(elements)
        
        # Upload to Cloudinary
        buffer.seek(0)
        upload_result = cloudinary.uploader.upload(
            buffer,
            folder=f"rotc/reports",
            resource_type='raw',
            public_id=f"{report_type}_{user_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}",
            format='pdf'
        )
        
        logger.info(f"Successfully generated PDF report: {upload_result['secure_url']}")
        
        return {
            'url': upload_result['secure_url'],
            'public_id': upload_result['public_id'],
            'report_type': report_type,
            'generated_at': timezone.now().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error generating PDF report: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(name='cleanup_old_audit_logs')
def cleanup_old_audit_logs(days=90):
    """
    Clean up audit logs older than specified days.
    
    Args:
        days: Number of days to keep audit logs
    
    Returns:
        int: Number of deleted records
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import AuditLog
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = AuditLog.objects.filter(created_at__lt=cutoff_date).delete()
        logger.info(f"Cleaned up {deleted_count} audit logs older than {days} days")
        return deleted_count
    except Exception as e:
        logger.error(f"Error cleaning up audit logs: {str(e)}")
        raise



@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def import_rotcmis_data(self, json_data, user_id):
    """
    Import cadet data from ROTCMIS JSON format.
    
    Args:
        json_data: Dictionary or list of cadet data from ROTCMIS
        user_id: ID of the user who initiated the import
    
    Returns:
        dict: Import results with success/failure counts
    """
    from apps.cadets.models import Cadet, Grades
    from apps.authentication.models import User
    from django.db import transaction
    import json
    
    try:
        logger.info(f"Starting ROTCMIS data import for user {user_id}")
        
        # Ensure json_data is a list
        if isinstance(json_data, str):
            json_data = json.loads(json_data)
        
        if not isinstance(json_data, list):
            json_data = [json_data]
        
        success_count = 0
        error_count = 0
        errors = []
        
        for cadet_data in json_data:
            try:
                with transaction.atomic():
                    # Check if cadet already exists
                    student_id = cadet_data.get('student_id')
                    if not student_id:
                        raise ValueError("Missing student_id")
                    
                    # Create or update cadet
                    cadet, created = Cadet.objects.update_or_create(
                        student_id=student_id,
                        defaults={
                            'first_name': cadet_data.get('first_name', ''),
                            'last_name': cadet_data.get('last_name', ''),
                            'middle_name': cadet_data.get('middle_name'),
                            'suffix_name': cadet_data.get('suffix_name'),
                            'company': cadet_data.get('company'),
                            'platoon': cadet_data.get('platoon'),
                            'course': cadet_data.get('course'),
                            'year_level': cadet_data.get('year_level'),
                            'status': cadet_data.get('status', 'Ongoing'),
                            'email': cadet_data.get('email'),
                            'contact_number': cadet_data.get('contact_number'),
                            'birthdate': cadet_data.get('birthdate'),
                            'birthplace': cadet_data.get('birthplace'),
                            'age': cadet_data.get('age'),
                            'height': cadet_data.get('height'),
                            'weight': cadet_data.get('weight'),
                            'blood_type': cadet_data.get('blood_type'),
                            'address': cadet_data.get('address'),
                            'civil_status': cadet_data.get('civil_status'),
                            'nationality': cadet_data.get('nationality'),
                            'gender': cadet_data.get('gender'),
                            'rotc_unit': cadet_data.get('rotc_unit'),
                            'mobilization_center': cadet_data.get('mobilization_center'),
                        }
                    )
                    
                    # Create grades record if it doesn't exist
                    if created:
                        Grades.objects.create(cadet=cadet)
                    
                    success_count += 1
                    logger.info(f"{'Created' if created else 'Updated'} cadet: {student_id}")
                    
            except Exception as e:
                error_count += 1
                error_msg = f"Error importing cadet {cadet_data.get('student_id', 'unknown')}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Create notification for the user
        from apps.messaging.models import Notification
        notification_message = f"ROTCMIS import completed: {success_count} successful, {error_count} failed"
        Notification.objects.create(
            user_id=user_id,
            message=notification_message,
            type='import_complete'
        )
        
        result = {
            'success_count': success_count,
            'error_count': error_count,
            'total': len(json_data),
            'errors': errors[:10]  # Limit to first 10 errors
        }
        
        logger.info(f"ROTCMIS import completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Error in ROTCMIS import: {str(exc)}")
        
        # Notify user of failure
        try:
            from apps.messaging.models import Notification
            Notification.objects.create(
                user_id=user_id,
                message=f"ROTCMIS import failed: {str(exc)}",
                type='import_failed'
            )
        except:
            pass
        
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def bulk_update_cadets(self, updates_data, user_id):
    """
    Perform bulk updates on cadet records.
    
    Args:
        updates_data: List of dicts with cadet_id and fields to update
        user_id: ID of the user who initiated the update
    
    Returns:
        dict: Update results
    """
    from apps.cadets.models import Cadet
    from django.db import transaction
    
    try:
        logger.info(f"Starting bulk cadet update for user {user_id}")
        
        success_count = 0
        error_count = 0
        errors = []
        
        for update in updates_data:
            try:
                with transaction.atomic():
                    cadet_id = update.get('cadet_id')
                    if not cadet_id:
                        raise ValueError("Missing cadet_id")
                    
                    cadet = Cadet.objects.get(id=cadet_id)
                    
                    # Update fields
                    for field, value in update.items():
                        if field != 'cadet_id' and hasattr(cadet, field):
                            setattr(cadet, field, value)
                    
                    cadet.save()
                    success_count += 1
                    
            except Exception as e:
                error_count += 1
                error_msg = f"Error updating cadet {update.get('cadet_id', 'unknown')}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Create notification
        from apps.messaging.models import Notification
        notification_message = f"Bulk update completed: {success_count} successful, {error_count} failed"
        Notification.objects.create(
            user_id=user_id,
            message=notification_message,
            type='bulk_update_complete'
        )
        
        result = {
            'success_count': success_count,
            'error_count': error_count,
            'total': len(updates_data),
            'errors': errors[:10]
        }
        
        logger.info(f"Bulk update completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Error in bulk update: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)



@shared_task(name='check_performance_alerts')
def check_performance_alerts_task():
    """
    Celery task to check performance thresholds and send alerts.
    Should be run periodically (e.g., every 5 minutes).
    """
    from apps.system.performance_alerts import PerformanceAlertManager
    
    try:
        logger.info("Checking performance thresholds")
        PerformanceAlertManager.check_thresholds()
        return "Performance threshold check completed"
    except Exception as e:
        logger.error(f"Error in check_performance_alerts_task: {e}")
        raise
