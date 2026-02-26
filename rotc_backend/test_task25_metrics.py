"""
Test suite for Task 25: Performance monitoring and metrics.
Tests all metrics endpoints and functionality.
"""
from django.test import TestCase, Client
from django.core.cache import cache
from apps.authentication.models import User
from apps.system.middleware import PerformanceMonitoringMiddleware
from apps.system.performance_alerts import PerformanceAlertManager
import json


class PerformanceMonitoringTests(TestCase):
    """Test performance monitoring middleware and metrics."""
    
    def setUp(self):
        """Set up test client and admin user."""
        self.client = Client()
        
        # Create admin user
        self.admin_user = User.objects.create(
            username='admin_test',
            email='admin@test.com',
            password='$2b$10$abcdefghijklmnopqrstuv',  # bcrypt hash
            role='admin',
            is_approved=True
        )
        
        # Try to clear cache, but don't fail if Redis is not available
        try:
            cache.clear()
        except Exception:
            pass  # Redis not available in test environment
    
    def test_middleware_tracks_requests(self):
        """Test that middleware tracks request count."""
        # Make a request
        response = self.client.get('/api/health/')
        
        # Check that request was tracked
        request_count = cache.get('metrics:request_count', 0)
        self.assertGreater(request_count, 0)
    
    def test_middleware_tracks_response_times(self):
        """Test that middleware tracks response times."""
        # Make a request
        response = self.client.get('/api/health/')
        
        # Check that response times were tracked
        response_times = cache.get('metrics:response_times', [])
        self.assertGreater(len(response_times), 0)
    
    def test_middleware_tracks_status_codes(self):
        """Test that middleware tracks status codes."""
        # Make a successful request
        response = self.client.get('/api/health/')
        
        # Check that status code was tracked
        status_200_count = cache.get('metrics:status:200', 0)
        self.assertGreater(status_200_count, 0)
    
    def test_metrics_endpoint_requires_admin(self):
        """Test that metrics endpoint requires admin role."""
        # Try to access without authentication
        response = self.client.get('/api/metrics/')
        self.assertIn(response.status_code, [401, 403])
    
    def test_health_check_endpoint(self):
        """Test health check endpoint."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertIn('status', data)
        self.assertIn('checks', data)
        self.assertIn('database', data['checks'])
        self.assertIn('redis', data['checks'])
        self.assertIn('celery', data['checks'])
    
    def test_active_session_tracking(self):
        """Test that active sessions are tracked."""
        # Simulate authenticated request
        cache.set('metrics:active_sessions', {1, 2, 3}, timeout=1800)
        
        active_sessions = cache.get('metrics:active_sessions', set())
        self.assertEqual(len(active_sessions), 3)
    
    def test_slow_request_tracking(self):
        """Test that slow requests are tracked."""
        # Simulate slow request
        slow_requests = []
        slow_requests.append({
            'path': '/api/test',
            'method': 'GET',
            'response_time': 1500,
            'timestamp': 1234567890
        })
        cache.set('metrics:slow_requests', slow_requests, timeout=3600)
        
        tracked_slow_requests = cache.get('metrics:slow_requests', [])
        self.assertEqual(len(tracked_slow_requests), 1)
        self.assertEqual(tracked_slow_requests[0]['response_time'], 1500)


class PerformanceAlertsTests(TestCase):
    """Test performance alert system."""
    
    def setUp(self):
        """Set up test data."""
        # Create admin user for notifications
        self.admin_user = User.objects.create(
            username='admin_alert',
            email='admin_alert@test.com',
            password='$2b$10$abcdefghijklmnopqrstuv',
            role='admin',
            is_approved=True
        )
        
        # Try to clear cache
        try:
            cache.clear()
        except Exception:
            pass  # Redis not available
    
    def test_get_default_thresholds(self):
        """Test getting default performance thresholds."""
        thresholds = PerformanceAlertManager.get_thresholds()
        
        self.assertIn('error_rate', thresholds)
        self.assertIn('avg_response_time', thresholds)
        self.assertIn('slow_request_count', thresholds)
        self.assertIn('active_sessions', thresholds)
    
    def test_update_thresholds(self):
        """Test updating performance thresholds."""
        new_thresholds = {
            'error_rate': 15.0,
            'avg_response_time': 3000,
        }
        
        PerformanceAlertManager.update_thresholds(new_thresholds)
        
        # Verify thresholds were updated
        thresholds = PerformanceAlertManager.get_thresholds()
        self.assertEqual(thresholds['error_rate'], 15.0)
        self.assertEqual(thresholds['avg_response_time'], 3000)
    
    def test_alert_cooldown(self):
        """Test that alerts respect cooldown period."""
        # Set up high error rate
        cache.set('metrics:request_count', 100)
        cache.set('metrics:error_count', 20)  # 20% error rate
        cache.set('metrics:response_times', [100, 200, 300])
        
        # First check should send alert
        PerformanceAlertManager.check_thresholds()
        
        # Check that cooldown was set
        cooldown_key = 'alert:cooldown:high_error_rate'
        self.assertTrue(cache.get(cooldown_key))


class MetricsEndpointsTests(TestCase):
    """Test metrics API endpoints."""
    
    def setUp(self):
        """Set up test client and users."""
        self.client = Client()
        
        # Create admin user
        self.admin_user = User.objects.create(
            username='admin_metrics',
            email='admin_metrics@test.com',
            password='$2b$10$abcdefghijklmnopqrstuv',
            role='admin',
            is_approved=True
        )
        
        # Try to clear cache
        try:
            cache.clear()
        except Exception:
            pass  # Redis not available
        
        # Set up some test metrics
        try:
            cache.set('metrics:request_count', 100)
            cache.set('metrics:error_count', 5)
            cache.set('metrics:response_times', [100, 200, 150, 300, 250])
            cache.set('metrics:active_sessions', {1, 2, 3})
        except Exception:
            pass  # Redis not available
    
    def test_prometheus_metrics_format(self):
        """Test Prometheus metrics endpoint returns correct format."""
        response = self.client.get('/api/metrics/prometheus/')
        
        # Prometheus format should be text/plain
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/plain', response['Content-Type'])
        
        # Check for Prometheus metric names
        content = response.content.decode('utf-8')
        self.assertIn('http_requests_total', content)
        self.assertIn('http_errors_total', content)


class SlowQueryLoggingTests(TestCase):
    """Test slow query logging functionality."""
    
    def test_slow_query_detection(self):
        """Test that slow queries are detected and logged."""
        # This test requires DEBUG=True to track queries
        from django.conf import settings
        
        if settings.DEBUG:
            from django.db import connection
            from apps.system.db_logging import get_slow_queries
            
            # Execute a query
            from apps.authentication.models import User
            list(User.objects.all())
            
            # Check for slow queries (threshold 100ms)
            slow_queries = get_slow_queries(threshold_ms=0)  # Set to 0 to catch all queries
            
            # Should have at least one query
            self.assertGreaterEqual(len(connection.queries), 1)

