"""
Environment variable validation for Django settings.
Ensures all required environment variables are present before starting the application.
"""
import os
import sys
from typing import List, Dict, Optional


class EnvironmentValidationError(Exception):
    """Raised when required environment variables are missing or invalid."""
    pass


def validate_required_env_vars(required_vars: List[str], env_name: str = "production") -> Dict[str, str]:
    """
    Validate that all required environment variables are set.
    
    Args:
        required_vars: List of required environment variable names
        env_name: Environment name for error messages
    
    Returns:
        Dict of validated environment variables
    
    Raises:
        EnvironmentValidationError: If any required variables are missing
    """
    missing_vars = []
    env_values = {}
    
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
        else:
            env_values[var] = value
    
    if missing_vars:
        error_msg = (
            f"\n{'='*80}\n"
            f"ENVIRONMENT VALIDATION ERROR ({env_name})\n"
            f"{'='*80}\n"
            f"The following required environment variables are missing:\n"
        )
        for var in missing_vars:
            error_msg += f"  - {var}\n"
        error_msg += (
            f"\nPlease set these environment variables before starting the application.\n"
            f"{'='*80}\n"
        )
        raise EnvironmentValidationError(error_msg)
    
    return env_values


def validate_secret_key(secret_key: Optional[str]) -> str:
    """
    Validate SECRET_KEY is set and meets minimum security requirements.
    
    Args:
        secret_key: The SECRET_KEY value to validate
    
    Returns:
        The validated SECRET_KEY
    
    Raises:
        EnvironmentValidationError: If SECRET_KEY is invalid
    """
    if not secret_key:
        raise EnvironmentValidationError(
            "\n" + "="*80 + "\n"
            "SECURITY ERROR: SECRET_KEY is not set!\n"
            "="*80 + "\n"
            "The SECRET_KEY environment variable must be set for security.\n"
            "Generate a secure key using:\n"
            "  python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'\n"
            "="*80 + "\n"
        )
    
    # Check minimum length (50 characters recommended)
    if len(secret_key) < 50:
        print(
            f"\n{'='*80}\n"
            f"WARNING: SECRET_KEY is shorter than recommended (50+ characters)\n"
            f"Current length: {len(secret_key)} characters\n"
            f"{'='*80}\n",
            file=sys.stderr
        )
    
    # Check for default/insecure values
    insecure_patterns = [
        'change-this',
        'your-secret-key',
        'django-insecure',
        'secret',
        'password',
        '12345',
    ]
    
    secret_lower = secret_key.lower()
    for pattern in insecure_patterns:
        if pattern in secret_lower:
            raise EnvironmentValidationError(
                f"\n{'='*80}\n"
                f"SECURITY ERROR: SECRET_KEY appears to be insecure!\n"
                f"{'='*80}\n"
                f"The SECRET_KEY contains '{pattern}' which suggests it's a default value.\n"
                f"Please generate a secure random key.\n"
                f"{'='*80}\n"
            )
    
    return secret_key


def validate_database_url(database_url: Optional[str]) -> str:
    """
    Validate DATABASE_URL is set and has correct format.
    
    Args:
        database_url: The DATABASE_URL value to validate
    
    Returns:
        The validated DATABASE_URL
    
    Raises:
        EnvironmentValidationError: If DATABASE_URL is invalid
    """
    if not database_url:
        raise EnvironmentValidationError(
            "\n" + "="*80 + "\n"
            "DATABASE ERROR: DATABASE_URL is not set!\n"
            "="*80 + "\n"
            "The DATABASE_URL environment variable must be set.\n"
            "Format: postgresql://user:password@host:port/database\n"
            "="*80 + "\n"
        )
    
    # Basic format validation
    if not database_url.startswith(('postgresql://', 'postgres://')):
        raise EnvironmentValidationError(
            f"\n{'='*80}\n"
            f"DATABASE ERROR: DATABASE_URL has invalid format!\n"
            f"{'='*80}\n"
            f"Expected format: postgresql://user:password@host:port/database\n"
            f"Received: {database_url[:30]}...\n"
            f"{'='*80}\n"
        )
    
    return database_url


def validate_redis_url(redis_url: Optional[str]) -> str:
    """
    Validate REDIS_URL is set and has correct format.
    
    Args:
        redis_url: The REDIS_URL value to validate
    
    Returns:
        The validated REDIS_URL
    
    Raises:
        EnvironmentValidationError: If REDIS_URL is invalid
    """
    if not redis_url:
        raise EnvironmentValidationError(
            "\n" + "="*80 + "\n"
            "REDIS ERROR: REDIS_URL is not set!\n"
            "="*80 + "\n"
            "The REDIS_URL environment variable must be set.\n"
            "Format: redis://default:password@host:port\n"
            "="*80 + "\n"
        )
    
    # Basic format validation
    if not redis_url.startswith(('redis://', 'rediss://')):
        raise EnvironmentValidationError(
            f"\n{'='*80}\n"
            f"REDIS ERROR: REDIS_URL has invalid format!\n"
            f"{'='*80}\n"
            f"Expected format: redis://default:password@host:port\n"
            f"Received: {redis_url[:30]}...\n"
            f"{'='*80}\n"
        )
    
    return redis_url


def validate_allowed_hosts(allowed_hosts: str) -> List[str]:
    """
    Validate ALLOWED_HOSTS is set and parse into list.
    
    Args:
        allowed_hosts: Comma-separated list of allowed hosts
    
    Returns:
        List of allowed hosts
    
    Raises:
        EnvironmentValidationError: If ALLOWED_HOSTS is invalid
    """
    if not allowed_hosts:
        raise EnvironmentValidationError(
            "\n" + "="*80 + "\n"
            "SECURITY ERROR: ALLOWED_HOSTS is not set!\n"
            "="*80 + "\n"
            "The ALLOWED_HOSTS environment variable must be set in production.\n"
            "Format: host1.com,host2.com,host3.com\n"
            "="*80 + "\n"
        )
    
    hosts = [host.strip() for host in allowed_hosts.split(',') if host.strip()]
    
    if not hosts:
        raise EnvironmentValidationError(
            "\n" + "="*80 + "\n"
            "SECURITY ERROR: ALLOWED_HOSTS is empty!\n"
            "="*80 + "\n"
            "At least one host must be specified.\n"
            "="*80 + "\n"
        )
    
    return hosts


def validate_production_environment():
    """
    Validate all required environment variables for production deployment.
    
    This function should be called at the top of production.py settings file.
    
    Raises:
        EnvironmentValidationError: If any validation fails
    """
    print("\n" + "="*80)
    print("VALIDATING PRODUCTION ENVIRONMENT VARIABLES")
    print("="*80 + "\n")
    
    # Validate SECRET_KEY (check both DJANGO_SECRET_KEY and SECRET_KEY)
    secret_key = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY')
    validate_secret_key(secret_key)
    print("✓ SECRET_KEY validated")
    
    # Validate DATABASE_URL
    database_url = os.getenv('DATABASE_URL')
    validate_database_url(database_url)
    print("✓ DATABASE_URL validated")
    
    # Validate REDIS_URL
    redis_url = os.getenv('REDIS_URL')
    validate_redis_url(redis_url)
    print("✓ REDIS_URL validated")
    
    # Validate ALLOWED_HOSTS
    allowed_hosts = os.getenv('ALLOWED_HOSTS', '')
    if allowed_hosts:
        validate_allowed_hosts(allowed_hosts)
        print("✓ ALLOWED_HOSTS validated")
    else:
        print("⚠ WARNING: ALLOWED_HOSTS not set, using wildcard (not recommended)")
    
    # Optional but recommended variables
    optional_vars = {
        'CORS_ALLOWED_ORIGINS': 'CORS configuration',
        'CLOUDINARY_CLOUD_NAME': 'Cloudinary file storage',
        'CLOUDINARY_API_KEY': 'Cloudinary file storage',
        'CLOUDINARY_API_SECRET': 'Cloudinary file storage',
        'SENTRY_DSN': 'Error tracking',
    }
    
    missing_optional = []
    for var, description in optional_vars.items():
        if not os.getenv(var):
            missing_optional.append(f"  - {var} ({description})")
    
    if missing_optional:
        print("\n⚠ Optional environment variables not set:")
        for var in missing_optional:
            print(var)
    
    print("\n" + "="*80)
    print("ENVIRONMENT VALIDATION COMPLETE")
    print("="*80 + "\n")


def validate_development_environment():
    """
    Validate environment variables for development.
    Less strict than production validation.
    """
    print("\n" + "="*80)
    print("VALIDATING DEVELOPMENT ENVIRONMENT")
    print("="*80 + "\n")
    
    # In development, we can use defaults for most things
    secret_key = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY')
    if secret_key and 'django-insecure' not in secret_key.lower():
        print("⚠ WARNING: Using production-like SECRET_KEY in development")
    else:
        print("✓ Development SECRET_KEY configured")
    
    print("\n" + "="*80)
    print("DEVELOPMENT ENVIRONMENT READY")
    print("="*80 + "\n")
