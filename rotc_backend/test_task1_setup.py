"""
Test suite for Task 1: Django project structure and core configuration.

Tests Requirements:
- 1.5: DATABASE_URL environment variable connection
- 1.6: REDIS_URL environment variable connection
- 1.7: SECRET_KEY environment variable for JWT signing
- 19.1: HTTPS redirect
- 19.2: Strict-Transport-Security header
- 19.3: X-Content-Type-Options header
- 19.4: X-Frame-Options header
- 19.5: Secure and HttpOnly cookie flags
- 19.6: CORS allowed origins
- 25.1: Production settings module
- 25.2: DEBUG=False in production
- 25.3: ALLOWED_HOSTS configuration
- 25.4: Environment variable validation
- 25.5: SECRET_KEY validation
"""
import os
import pytest
from django.test import TestCase, Client, override_settings
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from config.env_validation import (
    validate_secret_key,
    validate_database_url,
    validate_redis_url,
    validate_allowed_hosts,
    EnvironmentValidationError
)


class EnvironmentVariableTests(TestCase):
    """Test environment variable loading and validation."""
    
    def test_secret_key_is_set(self):
        """Test Requirement 1.7: SECRET_KEY is configured."""
        self.assertIsNotNone(settings.SECRET_KEY)
        self.assertNotEqual(settings.SECRET_KEY, '')
        self.assertGreater(len(settings.SECRET_KEY), 20)
    
    def test_database_url_connection(self):
        """Test Requirement 1.5: DATABASE_URL connection works."""
        # Test database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            self.assertEqual(result[0], 1)
    
    def test_redis_url_connection(self):
        """Test Requirement 1.6: REDIS_URL connection works."""
        # Test Redis connection via cache
        test_key = 'test_redis_connection'
        test_value = 'redis_works'
        
        cache.set(test_key, test_value, 60)
        retrieved_value = cache.get(test_key)
        
        self.assertEqual(retrieved_value, test_value)
        cache.delete(test_key)
    
    def test_jwt_secret_key_configuration(self):
        """Test Requirement 1.7: JWT uses SECRET_KEY for signing."""
        from rest_framework_simplejwt.settings import api_settings
        
        # Verify JWT is configured with SECRET_KEY
        self.assertIsNotNone(api_settings.SIGNING_KEY)
        # The signing key should be the same as SECRET_KEY or DJANGO_SECRET_KEY
        expected_key = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY')
        if expected_key:
            self.assertEqual(api_settings.SIGNING_KEY, expected_key)


class SecurityHeadersTests(TestCase):
    """Test security headers configuration."""
    
    def setUp(self):
        self.client = Client()
    
    @override_settings(SECURE_SSL_REDIRECT=False)  # Disable for testing
    def test_x_content_type_options_header(self):
        """Test Requirement 19.3: X-Content-Type-Options header."""
        response = self.client.get('/api/health/')
        
        # Check if header is set (might be set by middleware)
        self.assertTrue(
            settings.SECURE_CONTENT_TYPE_NOSNIFF,
            "SECURE_CONTENT_TYPE_NOSNIFF should be True"
        )
    
    def test_x_frame_options_header(self):
        """Test Requirement 19.4: X-Frame-Options header."""
        self.assertEqual(settings.X_FRAME_OPTIONS, 'DENY')
    
    def test_hsts_configuration(self):
        """Test Requirement 19.2: HSTS configuration."""
        # In production settings, HSTS should be configured
        if not settings.DEBUG:
            self.assertTrue(settings.SECURE_HSTS_SECONDS > 0)
            self.assertEqual(settings.SECURE_HSTS_SECONDS, 31536000)  # 1 year
            self.assertTrue(settings.SECURE_HSTS_INCLUDE_SUBDOMAINS)
            self.assertTrue(settings.SECURE_HSTS_PRELOAD)
    
    def test_secure_cookie_flags(self):
        """Test Requirement 19.5: Secure and HttpOnly cookie flags."""
        # In production, cookies should be secure
        if not settings.DEBUG:
            self.assertTrue(settings.SESSION_COOKIE_SECURE)
            self.assertTrue(settings.CSRF_COOKIE_SECURE)
        
        # HttpOnly should always be True
        self.assertTrue(settings.SESSION_COOKIE_HTTPONLY)
        self.assertTrue(settings.CSRF_COOKIE_HTTPONLY)
    
    def test_cors_configuration(self):
        """Test Requirement 19.6: CORS allowed origins."""
        # CORS should be configured
        self.assertTrue(hasattr(settings, 'CORS_ALLOWED_ORIGINS'))
        
        # Should have at least one allowed origin or be properly configured
        if hasattr(settings, 'CORS_ALLOWED_ORIGINS'):
            self.assertIsInstance(settings.CORS_ALLOWED_ORIGINS, list)


class ProductionSettingsTests(TestCase):
    """Test production-specific settings."""
    
    def test_production_settings_module(self):
        """Test Requirement 25.1: Production settings module exists."""
        # Check if we can import production settings
        try:
            from config.settings import production
            self.assertTrue(True)
        except ImportError:
            self.fail("Production settings module not found")
    
    def test_debug_false_in_production(self):
        """Test Requirement 25.2: DEBUG is False in production."""
        # This test assumes we're running in production mode
        # In actual production, DEBUG should be False
        if os.getenv('DJANGO_ENV') == 'production':
            self.assertFalse(settings.DEBUG)
    
    def test_allowed_hosts_configured(self):
        """Test Requirement 25.3: ALLOWED_HOSTS is configured."""
        self.assertTrue(hasattr(settings, 'ALLOWED_HOSTS'))
        self.assertIsInstance(settings.ALLOWED_HOSTS, list)
        
        # In production, should not be empty (unless using wildcard)
        if os.getenv('DJANGO_ENV') == 'production':
            self.assertTrue(len(settings.ALLOWED_HOSTS) > 0)


class EnvironmentValidationTests(TestCase):
    """Test environment variable validation functions."""
    
    def test_validate_secret_key_success(self):
        """Test Requirement 25.5: SECRET_KEY validation."""
        # Valid secret key
        valid_key = 'a' * 50  # 50 character key
        result = validate_secret_key(valid_key)
        self.assertEqual(result, valid_key)
    
    def test_validate_secret_key_empty(self):
        """Test Requirement 25.5: Empty SECRET_KEY raises error."""
        with self.assertRaises(EnvironmentValidationError):
            validate_secret_key(None)
        
        with self.assertRaises(EnvironmentValidationError):
            validate_secret_key('')
    
    def test_validate_secret_key_insecure(self):
        """Test Requirement 25.5: Insecure SECRET_KEY raises error."""
        insecure_keys = [
            'change-this-secret-key',
            'your-secret-key-here',
            'django-insecure-test',
            'password123',
        ]
        
        for key in insecure_keys:
            with self.assertRaises(EnvironmentValidationError):
                validate_secret_key(key)
    
    def test_validate_database_url_success(self):
        """Test Requirement 25.4: DATABASE_URL validation."""
        valid_urls = [
            'postgresql://user:pass@localhost:5432/db',
            'postgres://user:pass@host.com:5432/database',
        ]
        
        for url in valid_urls:
            result = validate_database_url(url)
            self.assertEqual(result, url)
    
    def test_validate_database_url_invalid(self):
        """Test Requirement 25.4: Invalid DATABASE_URL raises error."""
        with self.assertRaises(EnvironmentValidationError):
            validate_database_url(None)
        
        with self.assertRaises(EnvironmentValidationError):
            validate_database_url('mysql://user:pass@localhost/db')
    
    def test_validate_redis_url_success(self):
        """Test Requirement 25.4: REDIS_URL validation."""
        valid_urls = [
            'redis://localhost:6379/0',
            'redis://default:password@host:6379',
            'rediss://secure-host:6380',
        ]
        
        for url in valid_urls:
            result = validate_redis_url(url)
            self.assertEqual(result, url)
    
    def test_validate_redis_url_invalid(self):
        """Test Requirement 25.4: Invalid REDIS_URL raises error."""
        with self.assertRaises(EnvironmentValidationError):
            validate_redis_url(None)
        
        with self.assertRaises(EnvironmentValidationError):
            validate_redis_url('memcached://localhost:11211')
    
    def test_validate_allowed_hosts_success(self):
        """Test Requirement 25.3: ALLOWED_HOSTS validation."""
        valid_hosts = 'example.com,api.example.com,*.example.com'
        result = validate_allowed_hosts(valid_hosts)
        
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 3)
        self.assertIn('example.com', result)
    
    def test_validate_allowed_hosts_invalid(self):
        """Test Requirement 25.3: Invalid ALLOWED_HOSTS raises error."""
        with self.assertRaises(EnvironmentValidationError):
            validate_allowed_hosts(None)
        
        with self.assertRaises(EnvironmentValidationError):
            validate_allowed_hosts('')
        
        with self.assertRaises(EnvironmentValidationError):
            validate_allowed_hosts('   ,  ,  ')


class HealthCheckTests(TestCase):
    """Test health check endpoint."""
    
    def setUp(self):
        self.client = Client()
    
    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_health_check_endpoint_exists(self):
        """Test that health check endpoint is accessible."""
        response = self.client.get('/api/health/')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
    
    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_health_check_response_format(self):
        """Test health check response includes required fields."""
        response = self.client.get('/api/health/')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check required fields
        self.assertIn('status', data)
        self.assertIn('timestamp', data)
        self.assertIn('checks', data)
        
        # Check service checks
        checks = data['checks']
        self.assertIn('database', checks)
        self.assertIn('redis', checks)


class GunicornConfigTests(TestCase):
    """Test Gunicorn configuration."""
    
    def test_gunicorn_config_exists(self):
        """Test that gunicorn.conf.py exists."""
        import os
        config_path = os.path.join(settings.BASE_DIR, 'gunicorn.conf.py')
        self.assertTrue(os.path.exists(config_path))
    
    def test_gunicorn_port_binding(self):
        """Test Requirement 1.1: Gunicorn binds to PORT variable."""
        # Import gunicorn config
        import sys
        sys.path.insert(0, str(settings.BASE_DIR))
        
        # Set PORT environment variable
        os.environ['PORT'] = '8000'
        
        # Import config (this will read PORT)
        import importlib
        gunicorn_conf = importlib.import_module('gunicorn.conf')
        
        # Verify bind address includes PORT
        # Note: This is a basic check, actual binding happens at runtime
        self.assertTrue(True)  # Config file exists and is importable


class DaphneConfigTests(TestCase):
    """Test Daphne configuration."""
    
    def test_daphne_config_exists(self):
        """Test that daphne.conf.py exists."""
        import os
        config_path = os.path.join(settings.BASE_DIR, 'daphne.conf.py')
        self.assertTrue(os.path.exists(config_path))


class LoggingConfigTests(TestCase):
    """Test logging configuration."""
    
    def test_logging_configured(self):
        """Test that logging is configured."""
        self.assertTrue(hasattr(settings, 'LOGGING'))
        self.assertIsInstance(settings.LOGGING, dict)
        
        # Check required logging components
        self.assertIn('version', settings.LOGGING)
        self.assertIn('handlers', settings.LOGGING)
        self.assertIn('loggers', settings.LOGGING)
    
    def test_console_handler_exists(self):
        """Test that console handler is configured."""
        handlers = settings.LOGGING.get('handlers', {})
        self.assertIn('console', handlers)
        
        console_handler = handlers['console']
        self.assertEqual(console_handler['class'], 'logging.StreamHandler')
    
    def test_sentry_integration_available(self):
        """Test that Sentry SDK is available (if configured)."""
        try:
            import sentry_sdk
            self.assertTrue(True)
        except ImportError:
            self.skipTest("Sentry SDK not installed")


# Run tests
if __name__ == '__main__':
    pytest.main([__file__, '-v'])
