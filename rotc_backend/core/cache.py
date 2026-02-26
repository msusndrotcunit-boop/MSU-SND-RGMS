"""
Cache utility functions for ROTC Backend.
Provides helper functions for cache key generation and invalidation.
"""
import hashlib
import json
import logging
from typing import Any, Optional, Dict, List
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


def get_cache_ttl(cache_type: str) -> int:
    """
    Get the TTL (Time To Live) for a specific cache type.
    
    Args:
        cache_type: Type of cache (cadet_list, grades, training_days, system_settings)
    
    Returns:
        TTL in seconds
    """
    return settings.CACHE_TTL.get(cache_type, 300)  # Default 5 minutes


def generate_cache_key(prefix: str, **kwargs) -> str:
    """
    Generate a cache key with the given prefix and parameters.
    
    Args:
        prefix: Cache key prefix (e.g., 'cadets:list', 'grades')
        **kwargs: Additional parameters to include in the key
    
    Returns:
        Generated cache key
    """
    if not kwargs:
        return f"{settings.CACHE_KEY_PREFIX}{prefix}"
    
    # Sort kwargs for consistent key generation
    sorted_params = sorted(kwargs.items())
    params_str = json.dumps(sorted_params, sort_keys=True)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
    
    return f"{settings.CACHE_KEY_PREFIX}{prefix}:{params_hash}"


def get_cached_data(key: str, default: Any = None) -> Optional[Any]:
    """
    Get data from cache with error handling.
    
    Args:
        key: Cache key
        default: Default value if cache miss or error
    
    Returns:
        Cached data or default value
    """
    try:
        data = cache.get(key, default)
        if data is not None:
            logger.debug(f"Cache hit: {key}")
        else:
            logger.debug(f"Cache miss: {key}")
        return data
    except Exception as e:
        logger.warning(f"Cache get error for key {key}: {str(e)}")
        return default


def set_cached_data(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """
    Set data in cache with error handling.
    
    Args:
        key: Cache key
        value: Data to cache
        ttl: Time to live in seconds (optional)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        cache.set(key, value, ttl)
        logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
        return True
    except Exception as e:
        logger.warning(f"Cache set error for key {key}: {str(e)}")
        return False


def delete_cached_data(key: str) -> bool:
    """
    Delete data from cache with error handling.
    
    Args:
        key: Cache key
    
    Returns:
        True if successful, False otherwise
    """
    try:
        cache.delete(key)
        logger.debug(f"Cache delete: {key}")
        return True
    except Exception as e:
        logger.warning(f"Cache delete error for key {key}: {str(e)}")
        return False


def delete_pattern(pattern: str) -> bool:
    """
    Delete all cache keys matching a pattern.
    
    Args:
        pattern: Pattern to match (e.g., 'cadets:*')
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Add prefix to pattern
        full_pattern = f"{settings.CACHE_KEY_PREFIX}{pattern}"
        
        # django-redis supports delete_pattern
        if hasattr(cache, 'delete_pattern'):
            cache.delete_pattern(full_pattern)
            logger.debug(f"Cache delete pattern: {full_pattern}")
            return True
        else:
            logger.warning(f"Cache backend does not support delete_pattern")
            return False
    except Exception as e:
        logger.warning(f"Cache delete pattern error for {pattern}: {str(e)}")
        return False


def invalidate_cadet_cache(cadet_id: Optional[int] = None) -> None:
    """
    Invalidate cadet-related cache entries.
    
    Args:
        cadet_id: Specific cadet ID to invalidate (optional)
    """
    try:
        # Invalidate all cadet lists
        delete_pattern('cadets:*')
        
        # Invalidate specific cadet if provided
        if cadet_id:
            delete_cached_data(f"cadets:detail:{cadet_id}")
            delete_cached_data(f"grades:{cadet_id}")
        
        logger.info(f"Invalidated cadet cache (cadet_id: {cadet_id})")
    except Exception as e:
        logger.error(f"Error invalidating cadet cache: {str(e)}")


def invalidate_grades_cache(cadet_id: int) -> None:
    """
    Invalidate grades-related cache entries.
    
    Args:
        cadet_id: Cadet ID whose grades cache should be invalidated
    """
    try:
        # Invalidate specific cadet's grades
        delete_cached_data(f"grades:{cadet_id}")
        
        # Invalidate cadet detail (includes grades)
        delete_cached_data(f"cadets:detail:{cadet_id}")
        
        # Invalidate all grades lists
        delete_pattern('grades:list*')
        
        logger.info(f"Invalidated grades cache for cadet {cadet_id}")
    except Exception as e:
        logger.error(f"Error invalidating grades cache: {str(e)}")


def invalidate_training_day_cache() -> None:
    """
    Invalidate training day cache entries.
    """
    try:
        delete_pattern('training_days:*')
        logger.info("Invalidated training day cache")
    except Exception as e:
        logger.error(f"Error invalidating training day cache: {str(e)}")


def invalidate_system_settings_cache(key: Optional[str] = None) -> None:
    """
    Invalidate system settings cache entries.
    
    Args:
        key: Specific setting key to invalidate (optional)
    """
    try:
        if key:
            delete_cached_data(f"system:settings:{key}")
            logger.info(f"Invalidated system setting cache: {key}")
        else:
            delete_pattern('system:settings:*')
            logger.info("Invalidated all system settings cache")
    except Exception as e:
        logger.error(f"Error invalidating system settings cache: {str(e)}")


def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics.
    
    Returns:
        Dictionary with cache statistics
    """
    try:
        # Try to get Redis-specific stats
        if hasattr(cache, '_cache'):
            redis_client = cache._cache.get_client()
            info = redis_client.info('stats')
            
            return {
                'backend': 'redis',
                'hits': info.get('keyspace_hits', 0),
                'misses': info.get('keyspace_misses', 0),
                'hit_rate': _calculate_hit_rate(
                    info.get('keyspace_hits', 0),
                    info.get('keyspace_misses', 0)
                ),
                'keys': redis_client.dbsize(),
                'memory_used': info.get('used_memory_human', 'N/A'),
            }
        else:
            return {
                'backend': 'locmem',
                'message': 'Statistics not available for in-memory cache'
            }
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        return {
            'error': str(e),
            'message': 'Unable to retrieve cache statistics'
        }


def _calculate_hit_rate(hits: int, misses: int) -> float:
    """
    Calculate cache hit rate percentage.
    
    Args:
        hits: Number of cache hits
        misses: Number of cache misses
    
    Returns:
        Hit rate as percentage (0-100)
    """
    total = hits + misses
    if total == 0:
        return 0.0
    return round((hits / total) * 100, 2)


def clear_all_cache() -> bool:
    """
    Clear all cache entries.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        cache.clear()
        logger.info("Cleared all cache entries")
        return True
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return False
