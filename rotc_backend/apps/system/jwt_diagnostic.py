"""
JWT Secret Key Diagnostic - NO AUTH REQUIRED
Helps debug JWT token signing/verification issues
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import os


@api_view(['GET'])
@permission_classes([AllowAny])
def jwt_secret_diagnostic(request):
    """
    Check which secret key is being used for JWT signing.
    Access via: /api/jwt-diagnostic
    """
    try:
        # Get environment variables
        env_secret_key = os.environ.get('SECRET_KEY', 'NOT_SET')
        env_django_secret_key = os.environ.get('DJANGO_SECRET_KEY', 'NOT_SET')
        
        # Get Django SECRET_KEY
        django_secret_key = settings.SECRET_KEY
        
        # Get JWT SIGNING_KEY
        jwt_signing_key = settings.SIMPLE_JWT.get('SIGNING_KEY', 'NOT_SET')
        
        # Check if they match
        keys_match = (django_secret_key == jwt_signing_key)
        
        # Mask the keys for security (show first 10 and last 4 chars)
        def mask_key(key):
            if key == 'NOT_SET' or len(key) < 20:
                return key
            return f"{key[:10]}...{key[-4:]}"
        
        return Response({
            'environment_variables': {
                'SECRET_KEY': mask_key(env_secret_key),
                'DJANGO_SECRET_KEY': mask_key(env_django_secret_key),
            },
            'django_settings': {
                'SECRET_KEY': mask_key(django_secret_key),
                'JWT_SIGNING_KEY': mask_key(jwt_signing_key),
            },
            'keys_match': keys_match,
            'status': 'OK' if keys_match else 'MISMATCH',
            'message': 'JWT signing and Django SECRET_KEY match' if keys_match else 'WARNING: Keys do not match! This will cause token validation errors.',
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e),
            'message': 'Failed to check JWT configuration'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
