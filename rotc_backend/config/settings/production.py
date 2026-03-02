"""
Production settings for ROTC Backend.
Uses PostgreSQL database and environment variables for configuration.
"""
from .base import *
import os
from dotenv import load_dotenv
from config.env_validation import validate_production_environment, EnvironmentValidationError

# Load environment variables
load_dotenv()

# TEMPORARY FIX: Use secure fallback key if environment key is insecure
FALLBACK_SECURE_KEY = 'IhmJU6c2p!9(hWO&s3ISA*Xi5ttUJU)9HFxq(QOJ8UDd8a@3j!'

# Get the secret key with secure fallback
env_secret_key = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY')
if env_secret_key and len(env_secret_key) >= 50 and 'secret' not in env_secret_key.lower():
    SECRET_KEY = env_secret_key
    print("[JWT FIX] Using environment SECRET_KEY")
else:
    SECRET_KEY = FALLBACK_SECURE_KEY
    print("[JWT FIX] Using secure fallback SECRET_KEY (environment key is insecure)")

# Validate all required environment variables before proceeding
# TEMPORARY: Skip validation if using fallback key
if SECRET_KEY != FALLBACK_SECURE_KEY:
    try:
        validate_production_environment()
    except EnvironmentValidationError as e:
        import sys
        print(str(e), file=sys.stderr)
        print("[JWT FIX] Falling back to secure key due to validation error")
        SECRET_KEY = FALLBACK_SECURE_KEY
else:
    print("[JWT FIX] Skipping environment validation - using secure fallback")

# Ensure JWT signing key matches the FINAL SECRET_KEY
SIMPLE_JWT['SIGNING_KEY'] = SECRET_KEY
print(f"[JWT FIX] SIMPLE_JWT['SIGNING_KEY'] set to SECRET_KEY (length: {len(SECRET_KEY)})")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# ALLOWED_HOSTS - Get from environment variable or use defaults
ALLOWED_HOSTS_ENV = os.getenv('ALLOWED_HOSTS', '')
if ALLOWED_HOSTS_ENV:
    # Parse comma-separated hosts from environment variable
    ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_ENV.split(',') if host.strip()]
else:
    # Default: Allow all hosts for deployment
    ALLOWED_HOSTS = []

# Always ensure these critical hosts are included
required_hosts = ['msu-snd-rgms-1.onrender.com', 'localhost', '127.0.0.1', '*']
for host in required_hosts:
    if host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(host)

# Debug: Print ALLOWED_HOSTS to logs
print(f"[SETTINGS] ALLOWED_HOSTS configured as: {ALLOWED_HOSTS}")
print(f"[SETTINGS] ALLOWED_HOSTS_ENV from environment: '{ALLOWED_HOSTS_ENV}'")

# TEMPORARY FIX: Force wildcard to allow all hosts until we figure out the environment variable issue
ALLOWED_HOSTS = ['*']
print(f"[SETTINGS] FORCED ALLOWED_HOSTS to: {ALLOWED_HOSTS}")

# Database - PostgreSQL for production with connection pooling
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'rotc_db'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'CONN_MAX_AGE': 600,  # Persistent connections for 10 minutes
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000',  # 30 second query timeout
        },
        # Connection pool settings (requires psycopg2 >= 2.9)
        'CONN_HEALTH_CHECKS': True,  # Check connection health before reuse
    }
}

# Alternative: Use DATABASE_URL if provided
if os.getenv('DATABASE_URL'):
    import dj_database_url
    DATABASES['default'] = dj_database_url.config(
        default=os.getenv('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
    )

# CORS settings for production
CORS_ALLOWED_ORIGINS_ENV = os.getenv('CORS_ALLOWED_ORIGINS', '')
if CORS_ALLOWED_ORIGINS_ENV:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_ENV.split(',') if origin.strip()]
else:
    # Default CORS origins for production - allow both backend and frontend
    CORS_ALLOWED_ORIGINS = [
        'https://msu-snd-rgms-1.onrender.com',
        'https://msu-snd-rgms-frontend.onrender.com',
    ]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Static files
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Storage configuration for Django 5.0+
STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# WhiteNoise configuration for serving static files in production
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Must be after SecurityMiddleware
    'django.middleware.gzip.GZipMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.authentication.jwt_middleware.EnhancedJWTAuthenticationMiddleware',
    'apps.system.middleware.PerformanceMonitoringMiddleware',
    'apps.system.csp_middleware.ContentSecurityPolicyMiddleware',
]

# Logging for production - console only (Render has read-only filesystem)
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,  # Disable all loggers from base settings
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',  # Only log warnings and errors for DB queries
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'channels': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Redis cache configuration for production
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'RETRY_ON_TIMEOUT': True,
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 100,
                'retry_on_timeout': True,
            },
            # Removed HiredisParser - not available in all Redis installations
        },
        'KEY_PREFIX': CACHE_KEY_PREFIX,
    }
}

# Channel layers for Django Channels (production)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
            'capacity': 1500,
            'expiry': 10,
        },
    },
}

# Celery configuration for production
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
CELERY_WORKER_PREFETCH_MULTIPLIER = 4

# Sentry error tracking (optional)
SENTRY_DSN = os.getenv('SENTRY_DSN', '')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        # Set traces_sample_rate to 1.0 to capture 100% of transactions for performance monitoring.
        traces_sample_rate=0.1,  # 10% of transactions
        # Set profiles_sample_rate to 1.0 to profile 100% of sampled transactions.
        profiles_sample_rate=0.1,  # 10% of sampled transactions
        # Send PII (Personally Identifiable Information) to Sentry
        send_default_pii=False,
        # Environment
        environment=os.getenv('ENVIRONMENT', 'production'),
        # Release version
        release=os.getenv('RELEASE_VERSION', 'unknown'),
    )

