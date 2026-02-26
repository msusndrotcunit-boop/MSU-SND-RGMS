"""
Celery tasks for batch PDF generation.
"""
import logging
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
import cloudinary.uploader
from apps.cadets.models import Cadet
from apps.system.models import AuditLog
from apps.messaging.models import Notification
from .generators import CadetProfilePDFGenerator, GradeReportPDFGenerator

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def batch_generate_cadet_pdfs(self, cadet_ids, user_id):
    """
    Generate PDF reports for multiple cadets in batch.
    
    Args:
        cadet_ids: List of cadet IDs to generate PDFs for
        user_id: ID of the user requesting the batch generation
    
    Returns:
        dict: Batch generation results with URLs
    """
    try:
        logger.info(f"Starting batch PDF generation for {len(cadet_ids)} cadets")
        
        results = []
        success_count = 0
        error_count = 0
        errors = []
        
        for cadet_id in cadet_ids:
            try:
                # Get cadet with grades
                cadet = Cadet.objects.select_related('grades').get(id=cadet_id)
                
                # Generate PDF
                generator = CadetProfilePDFGenerator()
                pdf_buffer = generator.generate(cadet)
                pdf_buffer.seek(0)
                
                # Upload to Cloudinary
                upload_result = cloudinary.uploader.upload(
                    pdf_buffer,
                    folder="rotc/reports/batch",
                    resource_type='raw',
                    public_id=f"cadet_profile_{cadet.student_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}",
                    format='pdf'
                )
                
                results.append({
                    'cadet_id': cadet_id,
                    'student_id': cadet.student_id,
                    'name': f"{cadet.first_name} {cadet.last_name}",
                    'url': upload_result['secure_url'],
                    'public_id': upload_result['public_id']
                })
                
                success_count += 1
                logger.info(f"Generated PDF for cadet {cadet_id}")
                
            except Cadet.DoesNotExist:
                error_count += 1
                error_msg = f"Cadet {cadet_id} not found"
                logger.error(error_msg)
                errors.append(error_msg)
                
            except Exception as e:
                error_count += 1
                error_msg = f"Error generating PDF for cadet {cadet_id}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Log the batch operation
        AuditLog.objects.create(
            table_name='reports',
            operation='CREATE',
            record_id=0,
            user_id=user_id,
            payload={
                'report_type': 'batch_cadet_profiles',
                'total_requested': len(cadet_ids),
                'success_count': success_count,
                'error_count': error_count,
                'generated_at': timezone.now().isoformat()
            }
        )
        
        # Create notification for the user
        notification_message = f"Batch PDF generation completed: {success_count} successful, {error_count} failed"
        Notification.objects.create(
            user_id=user_id,
            message=notification_message,
            type='batch_pdf_complete'
        )
        
        result = {
            'success_count': success_count,
            'error_count': error_count,
            'total': len(cadet_ids),
            'results': results,
            'errors': errors[:10]  # Limit to first 10 errors
        }
        
        logger.info(f"Batch PDF generation completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Error in batch PDF generation: {str(exc)}")
        
        # Notify user of failure
        try:
            Notification.objects.create(
                user_id=user_id,
                message=f"Batch PDF generation failed: {str(exc)}",
                type='batch_pdf_failed'
            )
        except:
            pass
        
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def batch_generate_certificates(self, activity_id, cadet_names, user_id):
    """
    Generate achievement certificates for multiple cadets in batch.
    
    Args:
        activity_id: ID of the activity
        cadet_names: List of cadet names to generate certificates for
        user_id: ID of the user requesting the batch generation
    
    Returns:
        dict: Batch generation results with URLs
    """
    from apps.activities.models import Activity
    from .generators import CertificatePDFGenerator
    import hashlib
    
    try:
        logger.info(f"Starting batch certificate generation for activity {activity_id}")
        
        # Get activity
        activity = Activity.objects.get(id=activity_id)
        
        results = []
        success_count = 0
        error_count = 0
        errors = []
        
        for cadet_name in cadet_names:
            try:
                # Generate verification code
                verification_data = f"{activity_id}:{cadet_name}:{activity.date}"
                verification_code = hashlib.sha256(verification_data.encode()).hexdigest()[:16].upper()
                
                # Generate PDF
                generator = CertificatePDFGenerator()
                pdf_buffer = generator.generate(activity, cadet_name, verification_code)
                pdf_buffer.seek(0)
                
                # Upload to Cloudinary
                safe_name = cadet_name.replace(' ', '_')
                upload_result = cloudinary.uploader.upload(
                    pdf_buffer,
                    folder="rotc/certificates/batch",
                    resource_type='raw',
                    public_id=f"certificate_{safe_name}_{activity_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}",
                    format='pdf'
                )
                
                results.append({
                    'cadet_name': cadet_name,
                    'activity_id': activity_id,
                    'activity_title': activity.title,
                    'verification_code': verification_code,
                    'url': upload_result['secure_url'],
                    'public_id': upload_result['public_id']
                })
                
                success_count += 1
                logger.info(f"Generated certificate for {cadet_name}")
                
            except Exception as e:
                error_count += 1
                error_msg = f"Error generating certificate for {cadet_name}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Log the batch operation
        AuditLog.objects.create(
            table_name='reports',
            operation='CREATE',
            record_id=activity_id,
            user_id=user_id,
            payload={
                'report_type': 'batch_certificates',
                'activity_id': activity_id,
                'total_requested': len(cadet_names),
                'success_count': success_count,
                'error_count': error_count,
                'generated_at': timezone.now().isoformat()
            }
        )
        
        # Create notification for the user
        notification_message = f"Batch certificate generation completed: {success_count} successful, {error_count} failed"
        Notification.objects.create(
            user_id=user_id,
            message=notification_message,
            type='batch_certificate_complete'
        )
        
        result = {
            'success_count': success_count,
            'error_count': error_count,
            'total': len(cadet_names),
            'results': results,
            'errors': errors[:10]
        }
        
        logger.info(f"Batch certificate generation completed: {result}")
        return result
        
    except Activity.DoesNotExist:
        error_msg = f"Activity {activity_id} not found"
        logger.error(error_msg)
        
        Notification.objects.create(
            user_id=user_id,
            message=f"Batch certificate generation failed: {error_msg}",
            type='batch_certificate_failed'
        )
        
        return {
            'success_count': 0,
            'error_count': len(cadet_names),
            'total': len(cadet_names),
            'results': [],
            'errors': [error_msg]
        }
        
    except Exception as exc:
        logger.error(f"Error in batch certificate generation: {str(exc)}")
        
        try:
            Notification.objects.create(
                user_id=user_id,
                message=f"Batch certificate generation failed: {str(exc)}",
                type='batch_certificate_failed'
            )
        except:
            pass
        
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
