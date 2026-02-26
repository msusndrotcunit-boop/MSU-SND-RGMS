"""
Database query monitoring and optimization utilities.
Tracks slow queries and provides optimization recommendations.
"""
import logging
import time
from django.db import connection
from django.conf import settings
from functools import wraps
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class QueryMonitor:
    """Monitor database queries and track slow queries."""
    
    def __init__(self, threshold_ms: float = 100):
        """
        Initialize query monitor.
        
        Args:
            threshold_ms: Threshold in milliseconds for slow query logging
        """
        self.threshold_ms = threshold_ms
        self.threshold_seconds = threshold_ms / 1000.0
        self.slow_queries = []
    
    def log_slow_query(self, query: str, duration: float, params: tuple = None):
        """
        Log a slow query.
        
        Args:
            query: SQL query string
            duration: Query execution time in seconds
            params: Query parameters
        """
        duration_ms = duration * 1000
        
        slow_query_info = {
            'query': query,
            'duration_ms': duration_ms,
            'params': params,
            'timestamp': time.time()
        }
        
        self.slow_queries.append(slow_query_info)
        
        logger.warning(
            f"Slow query detected ({duration_ms:.2f}ms): {query[:200]}...",
            extra={
                'query': query,
                'duration_ms': duration_ms,
                'params': params
            }
        )
    
    def get_slow_queries(self) -> List[Dict[str, Any]]:
        """Get list of slow queries."""
        return self.slow_queries
    
    def clear_slow_queries(self):
        """Clear slow query history."""
        self.slow_queries = []


# Global query monitor instance
query_monitor = QueryMonitor(threshold_ms=100)


def monitor_query_performance(func):
    """
    Decorator to monitor query performance of a function.
    Logs slow queries that exceed the threshold.
    
    Usage:
        @monitor_query_performance
        def my_view(request):
            # Your view code
            pass
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Reset query count
        initial_queries = len(connection.queries)
        start_time = time.time()
        
        # Execute function
        result = func(*args, **kwargs)
        
        # Calculate execution time
        end_time = time.time()
        duration = end_time - start_time
        
        # Check queries
        if settings.DEBUG:
            queries = connection.queries[initial_queries:]
            total_query_time = sum(float(q['time']) for q in queries)
            
            # Log if slow
            if duration > query_monitor.threshold_seconds:
                logger.warning(
                    f"Slow function: {func.__name__} took {duration*1000:.2f}ms "
                    f"({len(queries)} queries, {total_query_time*1000:.2f}ms in DB)",
                    extra={
                        'function': func.__name__,
                        'duration_ms': duration * 1000,
                        'query_count': len(queries),
                        'query_time_ms': total_query_time * 1000
                    }
                )
                
                # Log individual slow queries
                for query in queries:
                    query_time = float(query['time'])
                    if query_time > query_monitor.threshold_seconds:
                        query_monitor.log_slow_query(
                            query['sql'],
                            query_time,
                            query.get('params')
                        )
        
        return result
    
    return wrapper


def analyze_query_performance() -> Dict[str, Any]:
    """
    Analyze query performance and provide optimization recommendations.
    
    Returns:
        Dictionary with performance analysis and recommendations
    """
    if not settings.DEBUG:
        return {
            'error': 'Query analysis only available in DEBUG mode'
        }
    
    queries = connection.queries
    
    if not queries:
        return {
            'total_queries': 0,
            'total_time_ms': 0,
            'recommendations': []
        }
    
    # Calculate statistics
    total_queries = len(queries)
    total_time = sum(float(q['time']) for q in queries)
    avg_time = total_time / total_queries if total_queries > 0 else 0
    
    # Find slow queries
    slow_queries = [
        {
            'sql': q['sql'][:200],
            'time_ms': float(q['time']) * 1000
        }
        for q in queries
        if float(q['time']) > query_monitor.threshold_seconds
    ]
    
    # Detect N+1 queries
    query_patterns = {}
    for q in queries:
        # Extract table name from query
        sql = q['sql'].upper()
        if 'FROM' in sql:
            parts = sql.split('FROM')[1].split()
            if parts:
                table = parts[0].strip('`"')
                query_patterns[table] = query_patterns.get(table, 0) + 1
    
    # Find potential N+1 problems (same table queried many times)
    n_plus_one_suspects = [
        {'table': table, 'count': count}
        for table, count in query_patterns.items()
        if count > 10
    ]
    
    # Generate recommendations
    recommendations = []
    
    if slow_queries:
        recommendations.append({
            'type': 'slow_queries',
            'message': f'Found {len(slow_queries)} slow queries (>{query_monitor.threshold_ms}ms)',
            'action': 'Review and optimize slow queries, add indexes if needed'
        })
    
    if n_plus_one_suspects:
        recommendations.append({
            'type': 'n_plus_one',
            'message': f'Potential N+1 query problems detected',
            'tables': n_plus_one_suspects,
            'action': 'Use select_related() or prefetch_related() to optimize'
        })
    
    if total_queries > 50:
        recommendations.append({
            'type': 'too_many_queries',
            'message': f'High query count: {total_queries} queries',
            'action': 'Consider using bulk operations or caching'
        })
    
    return {
        'total_queries': total_queries,
        'total_time_ms': total_time * 1000,
        'avg_time_ms': avg_time * 1000,
        'slow_queries': slow_queries,
        'n_plus_one_suspects': n_plus_one_suspects,
        'recommendations': recommendations
    }


def get_query_statistics() -> Dict[str, Any]:
    """
    Get current query statistics.
    
    Returns:
        Dictionary with query statistics
    """
    if not settings.DEBUG:
        return {
            'error': 'Query statistics only available in DEBUG mode'
        }
    
    queries = connection.queries
    
    return {
        'total_queries': len(queries),
        'total_time_ms': sum(float(q['time']) for q in queries) * 1000,
        'slow_queries_count': len(query_monitor.get_slow_queries()),
        'queries': [
            {
                'sql': q['sql'][:200],
                'time_ms': float(q['time']) * 1000
            }
            for q in queries[-10:]  # Last 10 queries
        ]
    }


def reset_query_statistics():
    """Reset query statistics and slow query log."""
    if settings.DEBUG:
        connection.queries.clear()
    query_monitor.clear_slow_queries()
