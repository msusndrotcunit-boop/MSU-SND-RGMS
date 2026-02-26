"""
Celery tasks for import/export operations
"""
from celery import shared_task
from django.db import transaction
from django.core.cache import cache
from typing import Dict, Any, List
import logging

from apps.cadets.models import Cadet, Grades
from apps.system.models import AuditLog
from .importers import ROTCMISImporter, ImportResult, DataMergeStrategy

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def import_rotcmis_data(self, data: List[Dict[str, Any]], user_id: int, 
                       merge_strategy: str = DataMergeStrategy.SKIP) -> Dict[str, Any]:
    """
    Import ROTCMIS cadet data as background task
    
    Args:
        data: List of cadet data dictionaries
        user_id: ID of user performing the import
        merge_strategy: Strategy for handling existing records (skip, update, error)
        
    Returns:
        Dictionary with import results
    """
    result = ImportResult()
    task_id = self.request.id
    
    # Store initial status in cache
    cache.set(f'import_task_{task_id}', {
        'status': 'processing',
        'progress': 0,
        'total': len(data),
        'success_count': 0,
        'error_count': 0
    }, timeout=3600)
    
    try:
        for idx, cadet_data in enumerate(data):
            try:
                # Validate data
                is_valid, errors = ROTCMISImporter.validate_cadet_data(cadet_data)
                if not is_valid:
                    for error in errors:
                        result.add_error(idx + 1, 'validation', error, cadet_data)
                    continue
                
                # Normalize data
                normalized_data = ROTCMISImporter.normalize_cadet_data(cadet_data)
                
                # Check for existing cadet
                student_id = normalized_data.get('student_id')
                existing_cadet = None
                
                if student_id:
                    try:
                        existing_cadet = Cadet.objects.get(student_id=student_id)
                    except Cadet.DoesNotExist:
                        pass
                
                with transaction.atomic():
                    if existing_cadet:
                        # Handle existing record based on merge strategy
                        if DataMergeStrategy.should_update(merge_strategy, existing_cadet, normalized_data):
                            # Update existing cadet
                            for key, value in normalized_data.items():
                                setattr(existing_cadet, key, value)
                            existing_cadet.save()
                            
                            result.add_success(existing_cadet.id, created=False)
                            
                            # Create audit log
                            AuditLog.objects.create(
                                table_name='cadets',
                                operation='UPDATE',
                                record_id=existing_cadet.id,
                                user_id=user_id,
                                payload={'source': 'rotcmis_import', 'data': normalized_data}
                            )
                        else:
                            result.add_warning(f"Skipped existing cadet: {student_id}")
                    else:
                        # Create new cadet
                        cadet = Cadet.objects.create(**normalized_data)
                        
                        # Create associated grades record
                        Grades.objects.create(cadet=cadet)
                        
                        result.add_success(cadet.id, created=True)
                        
                        # Create audit log
                        AuditLog.objects.create(
                            table_name='cadets',
                            operation='CREATE',
                            record_id=cadet.id,
                            user_id=user_id,
                            payload={'source': 'rotcmis_import', 'data': normalized_data}
                        )
                
            except Exception as e:
                logger.error(f"Error importing cadet at row {idx + 1}: {str(e)}")
                result.add_error(idx + 1, 'exception', str(e), cadet_data)
            
            # Update progress in cache
            progress = int(((idx + 1) / len(data)) * 100)
            cache.set(f'import_task_{task_id}', {
                'status': 'processing',
                'progress': progress,
                'total': len(data),
                'success_count': result.success_count,
                'error_count': result.error_count
            }, timeout=3600)
        
        # Store final result in cache
        final_result = result.to_dict()
        cache.set(f'import_task_{task_id}', {
            'status': 'completed',
            'progress': 100,
            'total': len(data),
            **final_result
        }, timeout=3600)
        
        # Log import operation
        AuditLog.objects.create(
            table_name='cadets',
            operation='BULK_IMPORT',
            record_id=None,
            user_id=user_id,
            payload={
                'source': 'rotcmis',
                'total_records': len(data),
                'success_count': result.success_count,
                'error_count': result.error_count
            }
        )
        
        return final_result
        
    except Exception as e:
        logger.error(f"Fatal error in import task: {str(e)}")
        
        # Store error in cache
        cache.set(f'import_task_{task_id}', {
            'status': 'failed',
            'error': str(e),
            'progress': 0,
            'total': len(data)
        }, timeout=3600)
        
        # Retry the task
        raise self.retry(exc=e, countdown=60)


@shared_task
def cleanup_old_import_tasks():
    """
    Periodic task to clean up old import task results from cache
    """
    # This would be scheduled via Celery Beat
    # For now, cache entries expire after 1 hour automatically
    pass
