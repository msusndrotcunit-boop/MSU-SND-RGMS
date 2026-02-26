"""
Account lockout functionality to prevent brute force attacks.
"""
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta


# Lockout configuration
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
ATTEMPT_WINDOW_MINUTES = 15


def get_lockout_key(username):
    """Generate cache key for lockout tracking."""
    return f'lockout:attempts:{username}'


def get_lockout_time_key(username):
    """Generate cache key for lockout timestamp."""
    return f'lockout:time:{username}'


def is_account_locked(username):
    """
    Check if account is currently locked.
    
    Args:
        username: The username to check
        
    Returns:
        Tuple of (is_locked, remaining_time_seconds)
    """
    lockout_time_key = get_lockout_time_key(username)
    lockout_time = cache.get(lockout_time_key)
    
    if lockout_time:
        # Check if lockout period has expired
        now = timezone.now()
        if now < lockout_time:
            remaining = (lockout_time - now).total_seconds()
            return True, int(remaining)
        else:
            # Lockout expired, clear the lockout
            cache.delete(lockout_time_key)
            cache.delete(get_lockout_key(username))
            return False, 0
    
    return False, 0


def record_failed_attempt(username):
    """
    Record a failed login attempt and lock account if threshold exceeded.
    
    Args:
        username: The username that failed authentication
        
    Returns:
        Tuple of (is_locked, attempts, remaining_time_seconds)
    """
    attempts_key = get_lockout_key(username)
    lockout_time_key = get_lockout_time_key(username)
    
    # Get current attempt count
    attempts = cache.get(attempts_key, 0)
    attempts += 1
    
    # Store attempt count with expiry
    cache.set(attempts_key, attempts, ATTEMPT_WINDOW_MINUTES * 60)
    
    # Check if we should lock the account
    if attempts >= MAX_LOGIN_ATTEMPTS:
        lockout_until = timezone.now() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        cache.set(lockout_time_key, lockout_until, LOCKOUT_DURATION_MINUTES * 60)
        remaining = LOCKOUT_DURATION_MINUTES * 60
        return True, attempts, remaining
    
    return False, attempts, 0


def clear_failed_attempts(username):
    """
    Clear failed login attempts for a user (called on successful login).
    
    Args:
        username: The username to clear attempts for
    """
    cache.delete(get_lockout_key(username))
    cache.delete(get_lockout_time_key(username))


def get_remaining_attempts(username):
    """
    Get the number of remaining login attempts before lockout.
    
    Args:
        username: The username to check
        
    Returns:
        Number of remaining attempts
    """
    attempts = cache.get(get_lockout_key(username), 0)
    return max(0, MAX_LOGIN_ATTEMPTS - attempts)


def unlock_account(username):
    """
    Manually unlock an account (admin function).
    
    Args:
        username: The username to unlock
    """
    cache.delete(get_lockout_key(username))
    cache.delete(get_lockout_time_key(username))
