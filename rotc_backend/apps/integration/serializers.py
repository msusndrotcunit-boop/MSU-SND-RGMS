"""
Serializers for import/export operations
"""
from rest_framework import serializers


class ROTCMISImportSerializer(serializers.Serializer):
    """Serializer for ROTCMIS import request"""
    data = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of cadet data objects in ROTCMIS format"
    )
    merge_strategy = serializers.ChoiceField(
        choices=['skip', 'update', 'error'],
        default='skip',
        help_text="Strategy for handling existing records: skip (default), update, or error"
    )
    async_processing = serializers.BooleanField(
        default=True,
        help_text="Process import as background task (recommended for large imports)"
    )


class ImportStatusSerializer(serializers.Serializer):
    """Serializer for import status response"""
    task_id = serializers.CharField(help_text="Celery task ID")
    status = serializers.ChoiceField(
        choices=['pending', 'processing', 'completed', 'failed'],
        help_text="Current status of the import task"
    )
    progress = serializers.IntegerField(help_text="Progress percentage (0-100)")
    total = serializers.IntegerField(help_text="Total number of records to import")
    success_count = serializers.IntegerField(help_text="Number of successfully imported records")
    error_count = serializers.IntegerField(help_text="Number of failed records")
    errors = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="List of error details"
    )
    warnings = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of warning messages"
    )
    created_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="IDs of created records"
    )
    updated_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="IDs of updated records"
    )


class ExportFilterSerializer(serializers.Serializer):
    """Serializer for export filter parameters"""
    entity_type = serializers.ChoiceField(
        choices=['cadets', 'grades', 'attendance', 'activities'],
        required=True,
        help_text="Type of data to export"
    )
    date_from = serializers.DateField(
        required=False,
        help_text="Start date for filtering (YYYY-MM-DD)"
    )
    date_to = serializers.DateField(
        required=False,
        help_text="End date for filtering (YYYY-MM-DD)"
    )
    company = serializers.CharField(
        required=False,
        max_length=50,
        help_text="Filter by company"
    )
    platoon = serializers.CharField(
        required=False,
        max_length=50,
        help_text="Filter by platoon"
    )
    status = serializers.CharField(
        required=False,
        max_length=50,
        help_text="Filter by status"
    )


class CSVImportSerializer(serializers.Serializer):
    """Serializer for CSV import request"""
    file = serializers.FileField(
        help_text="CSV file to import"
    )
    entity_type = serializers.ChoiceField(
        choices=['cadets', 'grades', 'attendance'],
        required=True,
        help_text="Type of data being imported"
    )
    merge_strategy = serializers.ChoiceField(
        choices=['skip', 'update', 'error'],
        default='update',
        help_text="Strategy for handling existing records"
    )
