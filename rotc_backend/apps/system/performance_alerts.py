"""
Performance alert system for monitoring thresholds.
"""
import logging
from django.core.cache import cache
from apps.messaging.models import Notification
from apps.authentication.models import User

logger = logging.getLogger(__name__)


class PerformanceAlertManager:
    """
    Manages performance alerts and threshold monitoring.
    """
    
    # Default thresholds
    DEFAULT_THRESHOLDS = {
        'error_rate': 10.0,  # 10% error rate
        'avg_response_time': 2000,  # 2000ms average response time
        'slow_request_count': 50,  # 50 slow requests
        'active_sessions': 1000,  # 1000 active sessions
    }
    
    # Alert cooldown period (seconds)
    ALERT_COOLDOWN = 300  # 5 minutes
    
    @classmethod
    def check_thresholds(cls):
        """
        Check all performance thresholds and send alerts if exceeded.
        """
        try:
            # Get metrics from cache
            request_count = cache.get('metrics:request_count', 0)
            error_count = cache.get('metrics:error_count', 0)
            response_times = cache.get('metrics:response_times', [])
            slow_requests = cache.get('metrics:slow_requests', [])
            active_sessions = cache.get('metrics:active_sessions', set())
            
            # Calculate current metrics
            error_rate = (error_count / request_count * 100) if request_count > 0 else 0
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0
            slow_request_count = len(slow_requests)
            
            if isinstance(active_sessions, set):
                active_session_count = len(active_sessions)
            else:
                active_session_count = len(active_sessions) if active_sessions else 0
            
            # Check error rate threshold
            if error_rate > cls.DEFAULT_THRESHOLDS['error_rate']:
                cls._send_alert(
                    'high_error_rate',
                    f'High error rate detected: {error_rate:.2f}% (threshold: {cls.DEFAULT_THRESHOLDS["error_rate"]}%)',
                    {
                        'error_rate': error_rate,
                        'error_count': error_count,
                        'request_count': request_count
                    }
                )
            
            # Check average response time threshold
            if avg_response_time > cls.DEFAULT_THRESHOLDS['avg_response_time']:
                cls._send_alert(
                    'high_response_time',
                    f'High average response time: {avg_response_time:.2f}ms (threshold: {cls.DEFAULT_THRESHOLDS["avg_response_time"]}ms)',
                    {
                        'avg_response_time': avg_response_time,
                        'min_response_time': min(response_times) if response_times else 0,
                        'max_response_time': max(response_times) if response_times else 0
                    }
                )
            
            # Check slow request count threshold
            if slow_request_count > cls.DEFAULT_THRESHOLDS['slow_request_count']:
                cls._send_alert(
                    'high_slow_requests',
                    f'High number of slow requests: {slow_request_count} (threshold: {cls.DEFAULT_THRESHOLDS["slow_request_count"]})',
                    {
                        'slow_request_count': slow_request_count,
                        'recent_slow_requests': slow_requests[-5:]  # Last 5 slow requests
                    }
                )
            
            # Check active sessions threshold
            if active_session_count > cls.DEFAULT_THRESHOLDS['active_sessions']:
                cls._send_alert(
                    'high_active_sessions',
                    f'High number of active sessions: {active_session_count} (threshold: {cls.DEFAULT_THRESHOLDS["active_sessions"]})',
                    {
                        'active_sessions': active_session_count
                    }
                )
            
        except Exception as e:
            logger.error(f"Error checking performance thresholds: {e}")
    
    @classmethod
    def _send_alert(cls, alert_type, message, data):
        """
        Send performance alert to admins.
        
        Args:
            alert_type: Type of alert (e.g., 'high_error_rate')
            message: Alert message
            data: Additional data for the alert
        """
        try:
            # Check if alert was recently sent (cooldown)
            cooldown_key = f'alert:cooldown:{alert_type}'
            if cache.get(cooldown_key):
                logger.debug(f"Alert {alert_type} in cooldown period, skipping")
                return
            
            # Set cooldown
            cache.set(cooldown_key, True, cls.ALERT_COOLDOWN)
            
            # Get all admin users
            admin_users = User.objects.filter(role='admin')
            
            # Create notifications for each admin
            for admin in admin_users:
                Notification.objects.create(
                    user_id=admin.id,
                    message=message,
                    type='performance_alert',
                    is_read=False
                )
            
            logger.warning(f"Performance alert sent: {alert_type} - {message}")
            
        except Exception as e:
            logger.error(f"Error sending performance alert: {e}")
    
    @classmethod
    def update_thresholds(cls, thresholds):
        """
        Update performance alert thresholds.
        
        Args:
            thresholds: Dictionary of threshold values
        """
        try:
            # Store thresholds in cache
            cache.set('performance:thresholds', thresholds, timeout=None)
            logger.info(f"Performance thresholds updated: {thresholds}")
        except Exception as e:
            logger.error(f"Error updating thresholds: {e}")
    
    @classmethod
    def get_thresholds(cls):
        """
        Get current performance alert thresholds.
        
        Returns:
            Dictionary of threshold values
        """
        try:
            thresholds = cache.get('performance:thresholds')
            if thresholds:
                return thresholds
            return cls.DEFAULT_THRESHOLDS
        except Exception as e:
            logger.error(f"Error getting thresholds: {e}")
            return cls.DEFAULT_THRESHOLDS
