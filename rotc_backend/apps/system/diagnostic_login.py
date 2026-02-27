"""
Diagnostic Login - Performs actual login with detailed logging
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User as DjangoUser
from django.contrib.auth import authenticate
from apps.authentication.models import User
import logging


@api_view(['POST'])
@permission_classes([AllowAny])
def diagnostic_login(request):
    """
    Diagnostic login that shows exactly what's happening.
    POST /api/diagnostic-login
    Body: { "username": "msu-sndrotc_admin", "password": "admingrading@2026" }
    """
    logger = logging.getLogger('apps.authentication')
    
    username = request.data.get('username', 'msu-sndrotc_admin')
    password = request.data.get('password', 'admingrading@2026')
    
    log_entries = []
    
    def log(message, level='INFO'):
        log_entries.append(f"[{level}] {message}")
        if level == 'ERROR':
            logger.error(message)
        else:
            logger.info(message)
    
    try:
        log(f"Starting diagnostic login for username: {username}")
        
        # Step 1: Authenticate
        log("Calling authenticate()")
        user = authenticate(request, username=username, password=password)
        
        if user is None:
            log("Authentication failed - user is None", 'ERROR')
            return Response({
                'success': False,
                'error': 'Authentication failed',
                'logs': log_entries
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        log(f"Authentication successful - User ID: {user.id}, Username: {user.username}, Role: {user.role}")
        
        # Step 2: Create Django user wrapper
        log(f"Creating Django user wrapper for username: {username}")
        django_user, created = DjangoUser.objects.get_or_create(
            username=username,
            defaults={'email': user.email}
        )
        log(f"Django user {'created' if created else 'found'} - ID: {django_user.id}")
        
        # Step 3: Generate JWT tokens
        log("Generating JWT tokens")
        refresh = RefreshToken.for_user(django_user)
        
        # Add custom claims
        refresh['custom_user_id'] = user.id
        refresh['role'] = user.role
        log(f"Added custom claims - custom_user_id: {user.id}, role: {user.role}")
        
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        log(f"Tokens generated - Access token length: {len(access_token)}, Refresh token length: {len(refresh_token)}")
        
        # Step 4: Validate token immediately
        from rest_framework_simplejwt.tokens import AccessToken
        try:
            log("Validating access token immediately")
            decoded = AccessToken(access_token)
            payload = dict(decoded.payload)
            log(f"Token validation SUCCESS - Payload: {payload}")
            validation_success = True
            validation_error = None
        except Exception as e:
            log(f"Token validation FAILED - Error: {str(e)}", 'ERROR')
            validation_success = False
            validation_error = str(e)
        
        # Return response
        return Response({
            'success': True,
            'message': 'Diagnostic login successful',
            'token': access_token,
            'refresh': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'is_approved': user.is_approved
            },
            'django_user': {
                'id': django_user.id,
                'username': django_user.username,
                'created': created
            },
            'token_validation': {
                'success': validation_success,
                'error': validation_error
            },
            'logs': log_entries
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        log(f"Exception occurred: {str(e)}", 'ERROR')
        log(f"Traceback: {traceback.format_exc()}", 'ERROR')
        
        return Response({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'logs': log_entries
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
