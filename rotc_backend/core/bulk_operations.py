"""
Bulk operation utilities for performance optimization.
Provides helper functions for bulk_create and bulk_update operations.
"""
from django.db import transaction
from typing import List, Type, Dict, Any
from django.db.models import Model


def bulk_create_with_validation(
    model_class: Type[Model],
    data_list: List[Dict[str, Any]],
    batch_size: int = 100,
    ignore_conflicts: bool = False
) -> List[Model]:
    """
    Bulk create model instances with validation.
    
    Args:
        model_class: The Django model class
        data_list: List of dictionaries containing model data
        batch_size: Number of objects to create per batch
        ignore_conflicts: Whether to ignore unique constraint violations
    
    Returns:
        List of created model instances
    
    Example:
        cadets_data = [
            {'first_name': 'John', 'last_name': 'Doe', 'student_id': '12345'},
            {'first_name': 'Jane', 'last_name': 'Smith', 'student_id': '12346'},
        ]
        created_cadets = bulk_create_with_validation(Cadet, cadets_data)
    """
    instances = []
    
    for data in data_list:
        instance = model_class(**data)
        # Run model validation
        instance.full_clean()
        instances.append(instance)
    
    # Bulk create in batches
    created_instances = model_class.objects.bulk_create(
        instances,
        batch_size=batch_size,
        ignore_conflicts=ignore_conflicts
    )
    
    return created_instances


def bulk_update_optimized(
    model_class: Type[Model],
    updates: List[Dict[str, Any]],
    update_fields: List[str],
    id_field: str = 'id',
    batch_size: int = 100
) -> int:
    """
    Bulk update model instances efficiently.
    
    Args:
        model_class: The Django model class
        updates: List of dictionaries with id and fields to update
        update_fields: List of field names to update
        id_field: Name of the ID field (default: 'id')
        batch_size: Number of objects to update per batch
    
    Returns:
        Number of updated instances
    
    Example:
        updates = [
            {'id': 1, 'status': 'Completed', 'is_profile_completed': True},
            {'id': 2, 'status': 'Ongoing', 'is_profile_completed': False},
        ]
        count = bulk_update_optimized(Cadet, updates, ['status', 'is_profile_completed'])
    """
    if not updates:
        return 0
    
    # Get IDs to fetch
    ids = [update[id_field] for update in updates]
    
    # Fetch existing instances
    instances = model_class.objects.filter(**{f'{id_field}__in': ids})
    instance_dict = {getattr(inst, id_field): inst for inst in instances}
    
    # Update instances
    instances_to_update = []
    for update_data in updates:
        instance_id = update_data[id_field]
        if instance_id in instance_dict:
            instance = instance_dict[instance_id]
            for field in update_fields:
                if field in update_data:
                    setattr(instance, field, update_data[field])
            instances_to_update.append(instance)
    
    # Bulk update
    if instances_to_update:
        model_class.objects.bulk_update(
            instances_to_update,
            update_fields,
            batch_size=batch_size
        )
    
    return len(instances_to_update)


@transaction.atomic
def bulk_create_attendance_records(
    training_day_id: int,
    cadet_ids: List[int],
    status: str = 'present',
    batch_size: int = 100
) -> List:
    """
    Bulk create attendance records for multiple cadets.
    
    Args:
        training_day_id: ID of the training day
        cadet_ids: List of cadet IDs
        status: Attendance status (default: 'present')
        batch_size: Number of records to create per batch
    
    Returns:
        List of created attendance records
    
    Example:
        records = bulk_create_attendance_records(
            training_day_id=1,
            cadet_ids=[1, 2, 3, 4, 5],
            status='present'
        )
    """
    from apps.attendance.models import AttendanceRecord
    from apps.cadets.models import Cadet
    
    # Verify cadets exist
    existing_cadets = set(
        Cadet.objects.filter(id__in=cadet_ids).values_list('id', flat=True)
    )
    
    # Create attendance records
    records = []
    for cadet_id in cadet_ids:
        if cadet_id in existing_cadets:
            records.append(
                AttendanceRecord(
                    training_day_id=training_day_id,
                    cadet_id=cadet_id,
                    status=status
                )
            )
    
    # Bulk create with ignore_conflicts to handle duplicates
    created_records = AttendanceRecord.objects.bulk_create(
        records,
        batch_size=batch_size,
        ignore_conflicts=True
    )
    
    return created_records


@transaction.atomic
def bulk_update_grades(
    grade_updates: List[Dict[str, Any]],
    batch_size: int = 100
) -> int:
    """
    Bulk update grade records efficiently.
    
    Args:
        grade_updates: List of dictionaries with cadet_id and grade fields
        batch_size: Number of records to update per batch
    
    Returns:
        Number of updated grade records
    
    Example:
        updates = [
            {'cadet_id': 1, 'prelim_score': 85.5, 'midterm_score': 90.0},
            {'cadet_id': 2, 'prelim_score': 78.0, 'midterm_score': 82.5},
        ]
        count = bulk_update_grades(updates)
    """
    from apps.cadets.models import Grades
    
    if not grade_updates:
        return 0
    
    # Get cadet IDs
    cadet_ids = [update['cadet_id'] for update in grade_updates]
    
    # Fetch existing grades
    grades_dict = {
        grade.cadet_id: grade
        for grade in Grades.objects.filter(cadet_id__in=cadet_ids)
    }
    
    # Determine which fields to update
    update_fields = set()
    for update in grade_updates:
        update_fields.update(key for key in update.keys() if key != 'cadet_id')
    
    # Update grades
    grades_to_update = []
    for update_data in grade_updates:
        cadet_id = update_data['cadet_id']
        if cadet_id in grades_dict:
            grade = grades_dict[cadet_id]
            for field, value in update_data.items():
                if field != 'cadet_id':
                    setattr(grade, field, value)
            grades_to_update.append(grade)
    
    # Bulk update
    if grades_to_update:
        Grades.objects.bulk_update(
            grades_to_update,
            list(update_fields),
            batch_size=batch_size
        )
    
    return len(grades_to_update)


def bulk_archive_cadets(
    cadet_ids: List[int],
    batch_size: int = 100
) -> int:
    """
    Bulk archive (soft delete) multiple cadets.
    
    Args:
        cadet_ids: List of cadet IDs to archive
        batch_size: Number of records to update per batch
    
    Returns:
        Number of archived cadets
    
    Example:
        count = bulk_archive_cadets([1, 2, 3, 4, 5])
    """
    from apps.cadets.models import Cadet
    
    # Use update() for efficient bulk update
    updated_count = Cadet.objects.filter(
        id__in=cadet_ids,
        is_archived=False
    ).update(is_archived=True)
    
    return updated_count


def bulk_restore_cadets(
    cadet_ids: List[int],
    batch_size: int = 100
) -> int:
    """
    Bulk restore (unarchive) multiple cadets.
    
    Args:
        cadet_ids: List of cadet IDs to restore
        batch_size: Number of records to update per batch
    
    Returns:
        Number of restored cadets
    
    Example:
        count = bulk_restore_cadets([1, 2, 3, 4, 5])
    """
    from apps.cadets.models import Cadet
    
    # Use update() for efficient bulk update
    updated_count = Cadet.objects.filter(
        id__in=cadet_ids,
        is_archived=True
    ).update(is_archived=False)
    
    return updated_count
