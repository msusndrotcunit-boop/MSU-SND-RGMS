"""
Views for system settings and admin endpoints.
"""
import json
import time
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.system.models import SystemSettings, SyncEvent, AuditLog
from apps.authentication.permissions import IsAdmin
from apps.system.serializers import SystemSettingsSerializer, AuditLogSerializer, SyncEventSerializer
from apps.messaging.websocket_utils import broadcast_system_settings_update
from core.cache import (
    generate_cache_key,
    get_cached_data,
    set_cached_data,
    get_cache_ttl,
    invalidate_system_settings_cache,
    get_cache_stats,
    clear_all_cache,
)


@api_view(['GET'])
@permission_classes([IsAdmin])
def system_settings_list(request):
    """
    Get all system settings (cached).
    GET /api/system-settings
    """
    cache_key = generate_cache_key('system:settings:all')
    
    # Try to get from cache
    cached_response = get_cached_data(cache_key)
    if cached_response is not None:
        return Response(cached_response, status=status.HTTP_200_OK)
    
    # Cache miss - fetch from database
    settings = SystemSettings.objects.all()
    settings_dict = {s.key: s.value for s in settings}
    
    # Cache the response
    ttl = get_cache_ttl('system_settings')
    set_cached_data(cache_key, settings_dict, ttl)
    
    return Response(settings_dict, status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@permission_classes([IsAdmin])
def system_settings_detail(request, key):
    """
    Get or update a specific system setting (cached).
    GET /api/system-settings/:key
    PUT /api/system-settings/:key
    """
    if request.method == 'GET':
        cache_key = generate_cache_key('system:settings', key=key)
        
        # Try to get from cache
        cached_response = get_cached_data(cache_key)
        if cached_response is not None:
            return Response({'key': key, 'value': cached_response}, status=status.HTTP_200_OK)
        
        # Cache miss - fetch from database
        try:
            setting = SystemSettings.objects.get(key=key)
            
            # Cache the response
            ttl = get_cache_ttl('system_settings')
            set_cached_data(cache_key, setting.value, ttl)
            
            return Response({'key': setting.key, 'value': setting.value}, status=status.HTTP_200_OK)
        except SystemSettings.DoesNotExist:
            return Response(
                {'error': f'Setting with key "{key}" not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    elif request.method == 'PUT':
        value = request.data.get('value')
        if value is None:
            return Response(
                {'error': 'Value is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate using serializer
        serializer = SystemSettingsSerializer(data={'key': key, 'value': str(value)})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Update or create setting
        setting, created = SystemSettings.objects.update_or_create(
            key=key,
            defaults={'value': str(value)}
        )
        
        # Create audit log
        AuditLog.objects.create(
            table_name='system_settings',
            operation='UPDATE' if not created else 'CREATE',
            record_id=setting.id,
            user_id=request.user.id if hasattr(request, 'user') else None,
            payload={'key': key, 'value': str(value)}
        )
        
        # Invalidate cache
        invalidate_system_settings_cache(key)
        
        # Broadcast update via WebSocket
        broadcast_system_settings_update(key, str(value))
        
        return Response({
            'key': setting.key,
            'value': setting.value,
            'created': created
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def system_settings_bulk_update(request):
    """
    Bulk update multiple system settings.
    POST /api/system-settings/bulk
    Body: {"settings": [{"key": "...", "value": "..."}, ...]}
    """
    settings_data = request.data.get('settings', [])
    
    if not isinstance(settings_data, list):
        return Response(
            {'error': 'settings must be an array'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not settings_data:
        return Response(
            {'error': 'settings array cannot be empty'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    updated_settings = []
    errors = []
    
    for idx, setting_data in enumerate(settings_data):
        key = setting_data.get('key')
        value = setting_data.get('value')
        
        if not key:
            errors.append({'index': idx, 'error': 'key is required'})
            continue
        
        if value is None:
            errors.append({'index': idx, 'key': key, 'error': 'value is required'})
            continue
        
        # Validate using serializer
        serializer = SystemSettingsSerializer(data={'key': key, 'value': str(value)})
        if not serializer.is_valid():
            errors.append({'index': idx, 'key': key, 'errors': serializer.errors})
            continue
        
        # Update or create setting
        setting, created = SystemSettings.objects.update_or_create(
            key=key,
            defaults={'value': str(value)}
        )
        
        # Create audit log
        AuditLog.objects.create(
            table_name='system_settings',
            operation='UPDATE' if not created else 'CREATE',
            record_id=setting.id,
            user_id=request.user.id if hasattr(request, 'user') else None,
            payload={'key': key, 'value': str(value)}
        )
        
        # Invalidate cache
        invalidate_system_settings_cache(key)
        
        # Broadcast update via WebSocket
        broadcast_system_settings_update(key, str(value))
        
        updated_settings.append({
            'key': setting.key,
            'value': setting.value,
            'created': created
        })
    
    response_data = {
        'updated': updated_settings,
        'updated_count': len(updated_settings)
    }
    
    if errors:
        response_data['errors'] = errors
        response_data['error_count'] = len(errors)
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def cache_stats_view(request):
    """
    Get cache statistics.
    GET /api/cache/stats
    """
    stats = get_cache_stats()
    return Response(stats, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def cache_clear_view(request):
    """
    Clear all cache entries.
    POST /api/cache/clear
    """
    success = clear_all_cache()
    
    if success:
        return Response({
            'message': 'Cache cleared successfully',
            'success': True
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'message': 'Failed to clear cache',
            'success': False
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def event_stream_generator(user, last_event_id=None):
    """
    Generator function for Server-Sent Events.
    Polls sync_events and yields new events.
    """
    # Track the last event ID we've sent
    if last_event_id:
        try:
            last_id = int(last_event_id)
        except (ValueError, TypeError):
            last_id = 0
    else:
        last_id = 0
    
    # Send initial connection message
    yield f"data: {json.dumps({'type': 'connected', 'message': 'SSE connection established'})}\n\n"
    
    # Poll for new events
    while True:
        try:
            # Get new sync events since last_id
            new_events = SyncEvent.objects.filter(
                id__gt=last_id,
                processed=False
            ).order_by('id')[:10]
            
            for event in new_events:
                # Check if user should receive this event
                should_send = False
                
                # Send to admins and training staff
                if user.role in ['admin', 'training_staff']:
                    should_send = True
                # Send to cadet if it's their event
                elif user.role == 'cadet' and event.cadet_id == user.cadet_id:
                    should_send = True
                
                if should_send:
                    event_data = {
                        'type': event.event_type,
                        'cadet_id': event.cadet_id,
                        'data': event.payload,
                        'timestamp': event.created_at.isoformat()
                    }
                    
                    yield f"id: {event.id}\n"
                    yield f"data: {json.dumps(event_data)}\n\n"
                    
                    last_id = event.id
            
            # Send heartbeat to keep connection alive
            if not new_events:
                yield f": heartbeat\n\n"
            
            # Wait before polling again
            time.sleep(2)
        
        except Exception as e:
            # Log error and continue
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in SSE stream: {e}")
            time.sleep(5)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_sse_view(request):
    """
    Server-Sent Events endpoint for real-time updates.
    Provides backward compatibility with SSE clients.
    GET /api/events
    """
    # Get Last-Event-ID header if present
    last_event_id = request.META.get('HTTP_LAST_EVENT_ID')
    
    # Get the authenticated user
    user = request.user
    
    # Create streaming response
    response = StreamingHttpResponse(
        event_stream_generator(user, last_event_id),
        content_type='text/event-stream'
    )
    
    # Set headers for SSE
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    
    return response



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_status_view(request, task_id):
    """
    Get the status of a Celery task.
    GET /api/tasks/:task_id/status
    """
    from celery.result import AsyncResult
    
    try:
        # Get task result
        task_result = AsyncResult(task_id)
        
        # Build response
        response_data = {
            'task_id': task_id,
            'status': task_result.state,
            'ready': task_result.ready(),
            'successful': task_result.successful() if task_result.ready() else None,
            'failed': task_result.failed() if task_result.ready() else None,
        }
        
        # Add result or error info
        if task_result.ready():
            if task_result.successful():
                response_data['result'] = task_result.result
            elif task_result.failed():
                response_data['error'] = str(task_result.info)
        else:
            # Task is still pending or running
            if task_result.state == 'PROGRESS':
                response_data['progress'] = task_result.info
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Error retrieving task status: {str(e)}',
            'task_id': task_id
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdmin])
def celery_health_check(request):
    """
    Check Celery worker health status.
    GET /api/celery/health
    """
    from celery import current_app
    from django.core.cache import cache
    import redis
    
    health_status = {
        'celery': 'unknown',
        'redis': 'unknown',
        'workers': [],
        'queues': [],
        'timestamp': time.time()
    }
    
    try:
        # Check Redis connection
        try:
            cache.set('health_check', 'ok', 10)
            if cache.get('health_check') == 'ok':
                health_status['redis'] = 'healthy'
            else:
                health_status['redis'] = 'unhealthy'
        except Exception as e:
            health_status['redis'] = f'unhealthy: {str(e)}'
        
        # Check Celery workers
        try:
            inspect = current_app.control.inspect()
            
            # Get active workers
            active_workers = inspect.active()
            if active_workers:
                health_status['celery'] = 'healthy'
                health_status['workers'] = list(active_workers.keys())
                
                # Get queue information
                active_queues = inspect.active_queues()
                if active_queues:
                    for worker, queues in active_queues.items():
                        for queue in queues:
                            if queue['name'] not in health_status['queues']:
                                health_status['queues'].append(queue['name'])
            else:
                health_status['celery'] = 'no_workers'
                
        except Exception as e:
            health_status['celery'] = f'unhealthy: {str(e)}'
        
        # Determine overall health
        overall_healthy = (
            health_status['redis'] == 'healthy' and
            health_status['celery'] == 'healthy'
        )
        
        health_status['overall'] = 'healthy' if overall_healthy else 'unhealthy'
        
        return Response(
            health_status,
            status=status.HTTP_200_OK if overall_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        
    except Exception as e:
        return Response({
            'error': f'Error checking Celery health: {str(e)}',
            'overall': 'error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdmin])
def celery_stats_view(request):
    """
    Get Celery task statistics.
    GET /api/celery/stats
    """
    from celery import current_app
    from django_celery_results.models import TaskResult
    from django.utils import timezone
    from datetime import timedelta
    
    try:
        inspect = current_app.control.inspect()
        
        # Get worker stats
        stats = inspect.stats()
        active_tasks = inspect.active()
        scheduled_tasks = inspect.scheduled()
        reserved_tasks = inspect.reserved()
        
        # Get task results from database (last 24 hours)
        last_24h = timezone.now() - timedelta(hours=24)
        recent_tasks = TaskResult.objects.filter(date_created__gte=last_24h)
        
        task_stats = {
            'total_tasks_24h': recent_tasks.count(),
            'successful_tasks_24h': recent_tasks.filter(status='SUCCESS').count(),
            'failed_tasks_24h': recent_tasks.filter(status='FAILURE').count(),
            'pending_tasks_24h': recent_tasks.filter(status='PENDING').count(),
            'workers': stats or {},
            'active_tasks': active_tasks or {},
            'scheduled_tasks': scheduled_tasks or {},
            'reserved_tasks': reserved_tasks or {},
        }
        
        return Response(task_stats, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Error retrieving Celery stats: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdmin])
def revoke_task_view(request, task_id):
    """
    Revoke (cancel) a running Celery task.
    POST /api/tasks/:task_id/revoke
    """
    from celery import current_app
    
    try:
        terminate = request.data.get('terminate', False)
        
        # Revoke the task
        current_app.control.revoke(task_id, terminate=terminate)
        
        return Response({
            'message': f'Task {task_id} revoked successfully',
            'task_id': task_id,
            'terminated': terminate
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Error revoking task: {str(e)}',
            'task_id': task_id
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['GET'])
@permission_classes([IsAdmin])
def audit_logs_list(request):
    """
    Get audit logs with filtering and pagination (admin only).
    GET /api/audit-logs
    
    Query parameters:
    - table_name: Filter by table name
    - operation: Filter by operation (CREATE, UPDATE, DELETE)
    - user_id: Filter by user ID
    - start_date: Filter by start date (YYYY-MM-DD)
    - end_date: Filter by end date (YYYY-MM-DD)
    - page: Page number (default: 1)
    - limit: Items per page (default: 50)
    """
    # Get query parameters
    table_name = request.GET.get('table_name')
    operation = request.GET.get('operation')
    user_id = request.GET.get('user_id')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 50))
    
    # Build query
    queryset = AuditLog.objects.all()
    
    if table_name:
        queryset = queryset.filter(table_name=table_name)
    
    if operation:
        queryset = queryset.filter(operation=operation.upper())
    
    if user_id:
        queryset = queryset.filter(user_id=user_id)
    
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    
    if end_date:
        queryset = queryset.filter(created_at__lte=end_date)
    
    # Order by most recent first
    queryset = queryset.order_by('-created_at')
    
    # Get total count
    total = queryset.count()
    
    # Pagination
    start = (page - 1) * limit
    end = start + limit
    logs = queryset[start:end]
    
    # Serialize
    serializer = AuditLogSerializer(logs, many=True)
    
    return Response({
        'logs': serializer.data,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'pages': (total + limit - 1) // limit
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def audit_logs_export(request):
    """
    Export audit logs to CSV format (admin only).
    GET /api/audit-logs/export
    
    Query parameters:
    - table_name: Filter by table name
    - operation: Filter by operation (CREATE, UPDATE, DELETE)
    - user_id: Filter by user ID
    - start_date: Filter by start date (YYYY-MM-DD)
    - end_date: Filter by end date (YYYY-MM-DD)
    - format: Export format (csv or excel, default: csv)
    """
    import csv
    from django.http import HttpResponse
    from datetime import datetime
    
    # Get query parameters
    table_name = request.GET.get('table_name')
    operation = request.GET.get('operation')
    user_id = request.GET.get('user_id')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    export_format = request.GET.get('format', 'csv').lower()
    
    # Build query
    queryset = AuditLog.objects.all()
    
    if table_name:
        queryset = queryset.filter(table_name=table_name)
    
    if operation:
        queryset = queryset.filter(operation=operation.upper())
    
    if user_id:
        queryset = queryset.filter(user_id=user_id)
    
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    
    if end_date:
        queryset = queryset.filter(created_at__lte=end_date)
    
    # Order by most recent first
    queryset = queryset.order_by('-created_at')
    
    if export_format == 'csv':
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        response['Content-Disposition'] = f'attachment; filename="audit_logs_{timestamp}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Table Name', 'Operation', 'Record ID', 'User ID', 'Payload', 'Created At'])
        
        for log in queryset:
            writer.writerow([
                log.id,
                log.table_name,
                log.operation,
                log.record_id,
                log.user_id or '',
                json.dumps(log.payload),
                log.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        return response
    
    elif export_format == 'excel':
        # Excel export using openpyxl
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font
            from django.http import HttpResponse
            
            wb = Workbook()
            ws = wb.active
            ws.title = "Audit Logs"
            
            # Header row
            headers = ['ID', 'Table Name', 'Operation', 'Record ID', 'User ID', 'Payload', 'Created At']
            ws.append(headers)
            
            # Make header bold
            for cell in ws[1]:
                cell.font = Font(bold=True)
            
            # Data rows
            for log in queryset:
                ws.append([
                    log.id,
                    log.table_name,
                    log.operation,
                    log.record_id,
                    log.user_id or '',
                    json.dumps(log.payload),
                    log.created_at.strftime('%Y-%m-%d %H:%M:%S')
                ])
            
            # Create response
            response = HttpResponse(
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            response['Content-Disposition'] = f'attachment; filename="audit_logs_{timestamp}.xlsx"'
            
            wb.save(response)
            return response
            
        except ImportError:
            return Response({
                'error': 'Excel export requires openpyxl package'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    else:
        return Response({
            'error': 'Invalid format. Use csv or excel'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAdmin])
def sync_events_list(request):
    """
    Get sync events for debugging (admin only).
    GET /api/sync-events
    
    Query parameters:
    - processed: Filter by processed status (true/false)
    - cadet_id: Filter by cadet ID
    - event_type: Filter by event type
    - page: Page number (default: 1)
    - limit: Items per page (default: 50)
    """
    # Get query parameters
    processed = request.GET.get('processed')
    cadet_id = request.GET.get('cadet_id')
    event_type = request.GET.get('event_type')
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 50))
    
    # Build query
    queryset = SyncEvent.objects.all()
    
    if processed is not None:
        processed_bool = processed.lower() in ['true', '1', 'yes']
        queryset = queryset.filter(processed=processed_bool)
    
    if cadet_id:
        queryset = queryset.filter(cadet_id=cadet_id)
    
    if event_type:
        queryset = queryset.filter(event_type=event_type)
    
    # Order by most recent first
    queryset = queryset.order_by('-created_at')
    
    # Get total count
    total = queryset.count()
    
    # Pagination
    start = (page - 1) * limit
    end = start + limit
    events = queryset[start:end]
    
    # Serialize
    serializer = SyncEventSerializer(events, many=True)
    
    return Response({
        'events': serializer.data,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'pages': (total + limit - 1) // limit
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def metrics_view(request):
    """
    Get performance metrics (admin only).
    GET /api/metrics
    
    Returns:
    - request_count: Total number of requests
    - avg_response_time: Average response time in milliseconds
    - error_rate: Percentage of requests that resulted in errors
    - status_codes: Breakdown of status codes
    - slow_requests: List of slow requests (>1000ms)
    """
    try:
        # Get metrics from cache
        request_count = cache.get('metrics:request_count', 0)
        error_count = cache.get('metrics:error_count', 0)
        response_times = cache.get('metrics:response_times', [])
        slow_requests = cache.get('metrics:slow_requests', [])
        active_sessions = cache.get('metrics:active_sessions', set())
        
        # Convert set to list for JSON serialization
        if isinstance(active_sessions, set):
            active_session_count = len(active_sessions)
        else:
            active_session_count = len(active_sessions) if active_sessions else 0
        
        # Calculate average response time
        avg_response_time = 0
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
        
        # Calculate error rate
        error_rate = 0
        if request_count > 0:
            error_rate = (error_count / request_count) * 100
        
        # Get status code breakdown
        status_codes = {}
        for code in [200, 201, 204, 400, 401, 403, 404, 500, 502, 503]:
            count = cache.get(f'metrics:status:{code}', 0)
            if count > 0:
                status_codes[str(code)] = count
        
        # Calculate min/max response times
        min_response_time = min(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        # Calculate median response time
        median_response_time = 0
        if response_times:
            sorted_times = sorted(response_times)
            mid = len(sorted_times) // 2
            if len(sorted_times) % 2 == 0:
                median_response_time = (sorted_times[mid - 1] + sorted_times[mid]) / 2
            else:
                median_response_time = sorted_times[mid]
        
        metrics_data = {
            'request_count': request_count,
            'error_count': error_count,
            'active_sessions': active_session_count,
            'avg_response_time': round(avg_response_time, 2),
            'min_response_time': round(min_response_time, 2),
            'max_response_time': round(max_response_time, 2),
            'median_response_time': round(median_response_time, 2),
            'error_rate': round(error_rate, 2),
            'status_codes': status_codes,
            'slow_requests_count': len(slow_requests),
            'slow_requests': slow_requests[-10:],  # Last 10 slow requests
            'timestamp': time.time()
        }
        
        return Response(metrics_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error retrieving metrics: {e}")
        return Response({
            'error': f'Error retrieving metrics: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdmin])
def database_metrics_view(request):
    """
    Get database performance metrics (admin only).
    GET /api/metrics/database
    
    Returns:
    - query_count: Number of queries executed
    - avg_query_time: Average query execution time
    - slow_queries: List of slow queries (>100ms)
    - connection_pool_stats: Database connection pool statistics
    """
    from django.db import connection
    from django.conf import settings
    
    try:
        # Get query statistics from Django debug toolbar or connection
        queries = connection.queries if settings.DEBUG else []
        
        query_count = len(queries)
        total_time = 0
        slow_queries = []
        
        for query in queries:
            time_ms = float(query.get('time', 0)) * 1000  # Convert to ms
            total_time += time_ms
            
            if time_ms > 100:  # Slow query threshold
                slow_queries.append({
                    'sql': query.get('sql', '')[:200],  # Truncate long queries
                    'time': round(time_ms, 2)
                })
        
        avg_query_time = (total_time / query_count) if query_count > 0 else 0
        
        # Get database connection info
        db_config = settings.DATABASES.get('default', {})
        db_engine = db_config.get('ENGINE', 'unknown')
        
        # Try to get connection pool stats (PostgreSQL specific)
        connection_stats = {
            'engine': db_engine,
            'connections_used': 'N/A',
            'connections_available': 'N/A'
        }
        
        # Get table sizes (PostgreSQL specific)
        table_stats = []
        if 'postgresql' in db_engine.lower():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT 
                            schemaname,
                            tablename,
                            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                            pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
                        FROM pg_tables
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY size_bytes DESC
                        LIMIT 10
                    """)
                    rows = cursor.fetchall()
                    for row in rows:
                        table_stats.append({
                            'schema': row[0],
                            'table': row[1],
                            'size': row[2]
                        })
            except Exception as e:
                logger.warning(f"Could not fetch table stats: {e}")
        
        metrics_data = {
            'query_count': query_count,
            'total_query_time': round(total_time, 2),
            'avg_query_time': round(avg_query_time, 2),
            'slow_queries_count': len(slow_queries),
            'slow_queries': slow_queries[:10],  # Last 10 slow queries
            'connection_stats': connection_stats,
            'table_stats': table_stats,
            'timestamp': time.time()
        }
        
        return Response(metrics_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error retrieving database metrics: {e}")
        return Response({
            'error': f'Error retrieving database metrics: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdmin])
def cache_metrics_view(request):
    """
    Get cache performance metrics (admin only).
    GET /api/metrics/cache
    
    Returns:
    - hit_rate: Cache hit rate percentage
    - miss_rate: Cache miss rate percentage
    - total_hits: Total cache hits
    - total_misses: Total cache misses
    - memory_usage: Cache memory usage (if available)
    """
    try:
        # Get cache statistics
        cache_stats = get_cache_stats()
        
        # Get additional Redis-specific stats if using Redis
        redis_stats = {}
        try:
            from django.core.cache import cache
            from django.core.cache.backends.redis import RedisCache
            
            if isinstance(cache, RedisCache):
                # Get Redis client
                redis_client = cache._cache.get_client()
                
                # Get Redis info
                info = redis_client.info()
                
                redis_stats = {
                    'used_memory': info.get('used_memory_human', 'N/A'),
                    'used_memory_peak': info.get('used_memory_peak_human', 'N/A'),
                    'connected_clients': info.get('connected_clients', 0),
                    'total_commands_processed': info.get('total_commands_processed', 0),
                    'keyspace_hits': info.get('keyspace_hits', 0),
                    'keyspace_misses': info.get('keyspace_misses', 0),
                    'evicted_keys': info.get('evicted_keys', 0),
                    'expired_keys': info.get('expired_keys', 0)
                }
                
                # Calculate hit rate from Redis stats
                total_ops = redis_stats['keyspace_hits'] + redis_stats['keyspace_misses']
                if total_ops > 0:
                    redis_hit_rate = (redis_stats['keyspace_hits'] / total_ops) * 100
                    redis_stats['hit_rate'] = round(redis_hit_rate, 2)
        except Exception as e:
            logger.warning(f"Could not fetch Redis stats: {e}")
        
        # Combine cache stats
        metrics_data = {
            'cache_backend': cache_stats.get('backend', 'unknown'),
            'hit_rate': cache_stats.get('hit_rate', 0),
            'miss_rate': cache_stats.get('miss_rate', 0),
            'total_hits': cache_stats.get('hits', 0),
            'total_misses': cache_stats.get('misses', 0),
            'redis_stats': redis_stats,
            'timestamp': time.time()
        }
        
        return Response(metrics_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error retrieving cache metrics: {e}")
        return Response({
            'error': f'Error retrieving cache metrics: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def health_check_view(request):
    """
    Health check endpoint for monitoring system status.
    GET /api/health
    
    Checks:
    - Database connectivity
    - Redis connectivity
    - Celery worker availability
    
    Returns overall health status and individual component statuses.
    """
    health_status = {
        'status': 'healthy',
        'timestamp': time.time(),
        'checks': {}
    }
    
    # Check database
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        health_status['checks']['database'] = {
            'status': 'healthy',
            'message': 'Database connection successful'
        }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'message': f'Database connection failed: {str(e)}'
        }
    
    # Check Redis
    try:
        cache.set('health_check', 'ok', 10)
        if cache.get('health_check') == 'ok':
            health_status['checks']['redis'] = {
                'status': 'healthy',
                'message': 'Redis connection successful'
            }
        else:
            health_status['status'] = 'unhealthy'
            health_status['checks']['redis'] = {
                'status': 'unhealthy',
                'message': 'Redis read/write test failed'
            }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['redis'] = {
            'status': 'unhealthy',
            'message': f'Redis connection failed: {str(e)}'
        }
    
    # Check Celery
    try:
        from celery import current_app
        inspect = current_app.control.inspect()
        active_workers = inspect.active()
        
        if active_workers:
            health_status['checks']['celery'] = {
                'status': 'healthy',
                'message': f'{len(active_workers)} worker(s) active',
                'workers': list(active_workers.keys())
            }
        else:
            health_status['status'] = 'degraded'
            health_status['checks']['celery'] = {
                'status': 'degraded',
                'message': 'No Celery workers available'
            }
    except Exception as e:
        health_status['status'] = 'degraded'
        health_status['checks']['celery'] = {
            'status': 'degraded',
            'message': f'Celery check failed: {str(e)}'
        }
    
    # Determine HTTP status code
    if health_status['status'] == 'healthy':
        status_code = status.HTTP_200_OK
    elif health_status['status'] == 'degraded':
        status_code = status.HTTP_200_OK  # Still operational
    else:
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    
    return Response(health_status, status=status_code)


@api_view(['GET'])
def prometheus_metrics_view(request):
    """
    Prometheus-compatible metrics export endpoint.
    GET /api/metrics/prometheus
    
    Returns metrics in Prometheus text format.
    """
    from prometheus_client import (
        CollectorRegistry, Gauge, Counter, Histogram,
        generate_latest, CONTENT_TYPE_LATEST
    )
    from django.http import HttpResponse
    
    try:
        # Create a custom registry
        registry = CollectorRegistry()
        
        # Get metrics from cache
        request_count = cache.get('metrics:request_count', 0)
        error_count = cache.get('metrics:error_count', 0)
        response_times = cache.get('metrics:response_times', [])
        active_sessions = cache.get('metrics:active_sessions', set())
        
        # Convert set to count
        if isinstance(active_sessions, set):
            active_session_count = len(active_sessions)
        else:
            active_session_count = len(active_sessions) if active_sessions else 0
        
        # Calculate metrics
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        error_rate = (error_count / request_count * 100) if request_count > 0 else 0
        
        # Define Prometheus metrics
        http_requests_total = Counter(
            'http_requests_total',
            'Total HTTP requests',
            registry=registry
        )
        http_requests_total.inc(request_count)
        
        http_errors_total = Counter(
            'http_errors_total',
            'Total HTTP errors',
            registry=registry
        )
        http_errors_total.inc(error_count)
        
        http_request_duration_seconds = Gauge(
            'http_request_duration_seconds',
            'Average HTTP request duration in seconds',
            registry=registry
        )
        http_request_duration_seconds.set(avg_response_time / 1000)  # Convert ms to seconds
        
        http_active_sessions = Gauge(
            'http_active_sessions',
            'Number of active user sessions',
            registry=registry
        )
        http_active_sessions.set(active_session_count)
        
        http_error_rate = Gauge(
            'http_error_rate',
            'HTTP error rate percentage',
            registry=registry
        )
        http_error_rate.set(error_rate)
        
        # Get status code breakdown
        for code in [200, 201, 204, 400, 401, 403, 404, 500, 502, 503]:
            count = cache.get(f'metrics:status:{code}', 0)
            if count > 0:
                status_counter = Counter(
                    f'http_status_{code}_total',
                    f'Total HTTP {code} responses',
                    registry=registry
                )
                status_counter.inc(count)
        
        # Generate Prometheus format output
        metrics_output = generate_latest(registry)
        
        return HttpResponse(
            metrics_output,
            content_type=CONTENT_TYPE_LATEST
        )
        
    except Exception as e:
        logger.error(f"Error generating Prometheus metrics: {e}")
        return HttpResponse(
            f"# Error generating metrics: {str(e)}\n",
            content_type='text/plain',
            status=500
        )


@api_view(['GET', 'PUT'])
@permission_classes([IsAdmin])
def performance_thresholds_view(request):
    """
    Get or update performance alert thresholds (admin only).
    GET /api/metrics/thresholds
    PUT /api/metrics/thresholds
    """
    from apps.system.performance_alerts import PerformanceAlertManager
    
    if request.method == 'GET':
        thresholds = PerformanceAlertManager.get_thresholds()
        return Response({
            'thresholds': thresholds,
            'timestamp': time.time()
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        thresholds = request.data.get('thresholds', {})
        
        if not thresholds:
            return Response({
                'error': 'thresholds object is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate threshold values
        valid_keys = ['error_rate', 'avg_response_time', 'slow_request_count', 'active_sessions']
        for key in thresholds.keys():
            if key not in valid_keys:
                return Response({
                    'error': f'Invalid threshold key: {key}. Valid keys: {valid_keys}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update thresholds
        PerformanceAlertManager.update_thresholds(thresholds)
        
        return Response({
            'message': 'Performance thresholds updated successfully',
            'thresholds': thresholds
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def check_performance_alerts_view(request):
    """
    Manually trigger performance alert check (admin only).
    POST /api/metrics/check-alerts
    """
    from apps.system.performance_alerts import PerformanceAlertManager
    
    try:
        PerformanceAlertManager.check_thresholds()
        return Response({
            'message': 'Performance alert check completed',
            'timestamp': time.time()
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error checking performance alerts: {e}")
        return Response({
            'error': f'Error checking performance alerts: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)








@api_view(['GET'])
@permission_classes([IsAdmin])
def slow_query_statistics(request):
    """
    Get slow query statistics and optimization recommendations.
    GET /api/system/slow-queries
    """
    from core.query_monitor import analyze_query_performance, query_monitor
    
    analysis = analyze_query_performance()
    slow_queries = query_monitor.get_slow_queries()
    
    return Response({
        'analysis': analysis,
        'recent_slow_queries': slow_queries[-20:],  # Last 20 slow queries
        'threshold_ms': query_monitor.threshold_ms
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def reset_query_statistics(request):
    """
    Reset query statistics and slow query log.
    POST /api/system/slow-queries/reset
    """
    from core.query_monitor import reset_query_statistics
    
    reset_query_statistics()
    
    return Response({
        'message': 'Query statistics reset successfully'
    }, status=status.HTTP_200_OK)
