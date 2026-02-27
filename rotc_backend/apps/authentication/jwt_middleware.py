"""
Enhanced JWT Authentication Middleware with comprehensive error handling.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError, AuthenticationFailed
from rest_framework.exceptions import AuthenticationFailed as DRFAuthenticationFailed
from apps.authentication.models import User
from django.http import JsonResponse
import logging
import uuid

logger = logging.getLogger('apps.authentication')


class EnhancedJWTAuthenticationMiddleware:
    """
    Enhanced JWT authentication middleware with detailed error handling and logging.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()
    
    def __call__(self, request):
        """Process the request and attach authenticated user."""
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())
        request.request_id = request_id
        
        # Skip authentication for public endpoints
        if self._is_public_endpoint(request.path):
            return self.get_response(request)
        
        # Try to authenticate using JWT
        try:
            auth_result = self.jwt_auth.authenticate(request)
            if auth_result is not None:
                django_user, token = auth_result
                
                # Fetch the actual User from our custom model using username
                try:
                    custom_user = User.objects.get(username=django_user.username)
                    request.user = custom_user
                    request.auth_user = custom_user
                    request.auth_token = token
                    
                    logger.debug(
                        f"[{request_id}] JWT authentication successful - User: {custom_user.username}, ID: {custom_user.id}"
                    )
                except User.DoesNotExist:
                    logger.warning(
                        f"[{request_id}] Django user exists but custom user not found - Username: {django_user.username}"
                    )
                    
        except InvalidToken as e:
            # Token is invalid (signature mismatch, malformed, etc.)
            error_detail = self._extract_error_detail(e)
            logger.warning(
                f"[{request_id}] Invalid JWT token - Path: {request.path}, Error: {error_detail}, IP: {self._get_client_ip(request)}"
            )
            # Don't block the request, let DRF handle it
            
        except TokenError as e:
            # Token error (expired, blacklisted, etc.)
            error_detail = self._extract_error_detail(e)
            logger.warning(
                f"[{request_id}] JWT token error - Path: {request.path}, Error: {error_detail}, IP: {self._get_client_ip(request)}"
            )
            # Don't block the request, let DRF handle it
            
        except AuthenticationFailed as e:
            # Authentication failed
            logger.warning(
                f"[{request_id}] JWT authentication failed - Path: {request.path}, Error: {str(e)}, IP: {self._get_client_ip(request)}"
            )
            # Don't block the request, let DRF handle it
            
        except Exception as e:
            # Unexpected error
            logger.error(
                f"[{request_id}] Unexpected JWT authentication error - Path: {request.path}, Error: {str(e)}, IP: {self._get_client_ip(request)}",
                exc_info=True
            )
            # Don't block the request, let DRF handle it
        
        response = self.get_response(request)
        
        # Add request ID to response headers for tracing
        response['X-Request-ID'] = request_id
        
        return response
    
    def _is_public_endpoint(self, path):
        """Check if the endpoint is public (doesn't require authentication)."""
        public_paths = [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/refresh',
            '/api/auth/cadet-login',
            '/api/auth/staff-login-no-pass',
            '/api/emergency-admin',
            '/api/jwt-diagnostic',
            '/api/test-token-flow',
            '/api/deep-auth-trace',
            '/api/diagnostic-login',
            '/api/create-trae-account',
            '/api/quick-check',
            '/api/admin-diagnostic',
            '/api/force-fix-admin',
            '/api/setup-admin',
            '/api/unlock-admin',
            '/static/',
            '/media/',
            '/admin/',
        ]
        
        for public_path in public_paths:
            if path.startswith(public_path):
                return True
        
        return False
    
    def _extract_error_detail(self, exception):
        """Extract detailed error information from exception."""
        if hasattr(exception, 'detail'):
            return str(exception.detail)
        return str(exception)
    
    def _get_client_ip(self, request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')


class JWTAuthenticationMiddleware(EnhancedJWTAuthenticationMiddleware):
    """
    Alias for backward compatibility.
    """
    pass
