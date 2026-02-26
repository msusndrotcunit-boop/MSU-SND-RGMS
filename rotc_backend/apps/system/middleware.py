"""
Performance monitoring middleware for ROTC Backend.
Tracks request/response timing, counts, and error rates.
"""
import time
import logging
from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)
slow_query_logger = logging.getLogger('django.db.backends')
request_logger = logging.getLogger('apps')


class PerformanceMonitoringMiddleware(MiddlewareMixin):
    """
    Middleware to track request/response timing and metrics.
    Stores metrics in Redis for aggregation.
    """
    
    def process_request(self, request):
        """
        Called before view processing.
        Records the start time of the request.
        """
        request._start_time = time.time()
        request._query_count_start = len(connection.queries) if settings.DEBUG else 0
        return None
    
    def process_response(self, request, response):
        """
        Called after view processing.
        Records response time and updates metrics.
        Logs slow queries if DEBUG is enabled.
        """
        if hasattr(request, '_start_time'):
            # Calculate response time in milliseconds
            response_time = (time.time() - request._start_time) * 1000
            
            # Store response time for this request
            request._response_time = response_time
            
            # Get client IP address
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0]
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            
            # Log all API requests
            user_info = 'anonymous'
            if hasattr(request, 'user') and request.user.is_authenticated:
                user_info = f'{request.user.username} (ID: {request.user.id})'
            
            request_logger.info(
                f'{request.method} {request.path} - {response.status_code} - {response_time:.2f}ms',
                extra={
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code,
                    'response_time': response_time,
                    'user': user_info,
                    'ip_address': ip_address,
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'event_type': 'api_request'
                }
            )
            
            # Log slow queries (>100ms)
            if settings.DEBUG and hasattr(request, '_query_count_start'):
                queries = connection.queries[request._query_count_start:]
                for query in queries:
                    query_time = float(query.get('time', 0))
                    if query_time > 0.1:  # 100ms threshold
                        slow_query_logger.warning(
                            f"Slow query ({query_time * 1000:.2f}ms) in {request.path}: "
                            f"{query['sql'][:200]}"
                        )
            
            # Update metrics in Redis
            try:
                self._update_metrics(request, response, response_time)
            except Exception as e:
                logger.error(f"Error updating performance metrics: {e}")
        
        return response
    
    def process_exception(self, request, exception):
        """
        Called when a view raises an exception.
        Tracks error rates.
        """
        try:
            # Increment error count
            cache.incr('metrics:error_count', delta=1)
            
            # Log the error
            logger.error(f"Request error: {exception}", exc_info=True)
        except Exception as e:
            logger.error(f"Error tracking exception: {e}")
        
        return None
    
    def _update_metrics(self, request, response, response_time):
        """
        Update performance metrics in Redis.
        """
        # Increment total request count
        cache.incr('metrics:request_count', delta=1)
        
        # Track active sessions
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_id = request.user.id
            active_sessions_key = 'metrics:active_sessions'
            active_sessions = cache.get(active_sessions_key, set())
            
            # Convert to set if it's a list (for compatibility)
            if isinstance(active_sessions, list):
                active_sessions = set(active_sessions)
            
            active_sessions.add(user_id)
            cache.set(active_sessions_key, active_sessions, timeout=1800)  # 30 minutes
        
        # Track response times (store last 1000 response times)
        response_times_key = 'metrics:response_times'
        response_times = cache.get(response_times_key, [])
        response_times.append(response_time)
        
        # Keep only last 1000 entries
        if len(response_times) > 1000:
            response_times = response_times[-1000:]
        
        cache.set(response_times_key, response_times, timeout=3600)  # 1 hour
        
        # Track status code counts
        status_code = response.status_code
        status_key = f'metrics:status:{status_code}'
        cache.incr(status_key, delta=1)
        
        # Track error rates (4xx and 5xx)
        if status_code >= 400:
            cache.incr('metrics:error_count', delta=1)
        
        # Track endpoint-specific metrics
        endpoint = request.path
        endpoint_key = f'metrics:endpoint:{endpoint}:count'
        cache.incr(endpoint_key, delta=1)
        
        endpoint_time_key = f'metrics:endpoint:{endpoint}:times'
        endpoint_times = cache.get(endpoint_time_key, [])
        endpoint_times.append(response_time)
        
        # Keep only last 100 entries per endpoint
        if len(endpoint_times) > 100:
            endpoint_times = endpoint_times[-100:]
        
        cache.set(endpoint_time_key, endpoint_times, timeout=3600)  # 1 hour
        
        # Track slow requests (>1000ms)
        if response_time > 1000:
            slow_requests_key = 'metrics:slow_requests'
            slow_requests = cache.get(slow_requests_key, [])
            slow_requests.append({
                'path': endpoint,
                'method': request.method,
                'response_time': response_time,
                'timestamp': time.time()
            })
            
            # Keep only last 100 slow requests
            if len(slow_requests) > 100:
                slow_requests = slow_requests[-100:]
            
            cache.set(slow_requests_key, slow_requests, timeout=3600)  # 1 hour


