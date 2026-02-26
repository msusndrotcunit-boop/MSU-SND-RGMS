"""
Database query logging utilities for slow query detection.
"""
import logging
import time
from django.db import connection
from django.conf import settings

logger = logging.getLogger('django.db.backends')


class SlowQueryLogger:
    """
    Context manager for logging slow database queries.
    """
    
    def __init__(self, threshold_ms=100):
        """
        Initialize slow query logger.
        
        Args:
            threshold_ms: Threshold in milliseconds for slow queries
        """
        self.threshold_ms = threshold_ms
        self.threshold_seconds = threshold_ms / 1000.0
        self.start_time = None
        self.query_count_start = None
    
    def __enter__(self):
        """Start timing queries."""
        self.start_time = time.time()
        self.query_count_start = len(connection.queries)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Log slow queries."""
        if not settings.DEBUG:
            return
        
        elapsed_time = time.time() - self.start_time
        queries = connection.queries[self.query_count_start:]
        
        for query in queries:
            query_time = float(query.get('time', 0))
            
            if query_time > self.threshold_seconds:
                logger.warning(
                    f"Slow query detected ({query_time * 1000:.2f}ms): {query['sql'][:200]}"
                )


def log_slow_queries(func):
    """
    Decorator to log slow queries in a function.
    
    Usage:
        @log_slow_queries
        def my_view(request):
            # Your code here
    """
    def wrapper(*args, **kwargs):
        with SlowQueryLogger():
            return func(*args, **kwargs)
    return wrapper


def get_slow_queries(threshold_ms=100):
    """
    Get list of slow queries from current request.
    
    Args:
        threshold_ms: Threshold in milliseconds
        
    Returns:
        List of slow query dictionaries
    """
    if not settings.DEBUG:
        return []
    
    threshold_seconds = threshold_ms / 1000.0
    slow_queries = []
    
    for query in connection.queries:
        query_time = float(query.get('time', 0))
        
        if query_time > threshold_seconds:
            slow_queries.append({
                'sql': query['sql'][:200],
                'time_ms': query_time * 1000,
                'time_seconds': query_time
            })
    
    return slow_queries
