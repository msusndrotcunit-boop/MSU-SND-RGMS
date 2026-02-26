"""
Custom authentication middleware.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.authentication.models import User


class JWTAuthenticationMiddleware:
    """
    Middleware to authenticate JWT tokens and attach User object to request.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()
    
    def __call__(self, request):
        """Process the request and attach authenticated user."""
        # Try to authenticate using JWT
        try:
            auth_result = self.jwt_auth.authenticate(request)
            if auth_result is not None:
                user, token = auth_result
                # Fetch the actual User from our custom model
                try:
                    auth_user = User.objects.get(id=user.id)
                    request.auth_user = auth_user
                except User.DoesNotExist:
                    pass
        except (AuthenticationFailed, Exception):
            pass
        
        response = self.get_response(request)
        return response
