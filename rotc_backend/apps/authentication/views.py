"""
Authentication views for login, register, logout, and profile.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from django.contrib.auth.models import User as DjangoUser
from django.contrib.auth import authenticate
from django_ratelimit.decorators import ratelimit
from apps.authentication.models import User, UserSettings
from apps.authentication.serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    LoginSerializer,
)
from apps.system.serializers import UserSettingsSerializer
from apps.authentication.lockout import (
    is_account_locked,
    record_failed_attempt,
    clear_failed_attempts,
    get_remaining_attempts
)
from core.cache import generate_cache_key, get_cached_data, set_cached_data, delete_cached_data


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def login_view(request):
    """
    Login endpoint that returns JWT token.
    POST /api/auth/login
    """
    import logging
    logger = logging.getLogger('apps.authentication')
    
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']
    
    # Get client IP address
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0]
    else:
        ip_address = request.META.get('REMOTE_ADDR')
    
    # Check if account is locked
    is_locked, remaining_time = is_account_locked(username)
    if is_locked:
        minutes_remaining = remaining_time // 60
        logger.warning(
            f'Login attempt on locked account - Username: {username}, IP: {ip_address}',
            extra={
                'username': username,
                'ip_address': ip_address,
                'event_type': 'locked_account_attempt'
            }
        )
        return Response(
            {
                'error': f'Account is locked due to too many failed login attempts. '
                        f'Please try again in {minutes_remaining} minutes.'
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    
    # Authenticate using Django's authenticate() which uses configured backends
    user = authenticate(request, username=username, password=password)
    
    if user is None:
        # Record failed attempt and check if account should be locked
        is_locked, attempts, remaining_time = record_failed_attempt(username)
        remaining_attempts = get_remaining_attempts(username)
        
        # Log failed authentication attempt
        logger.warning(
            f'Failed login attempt - Username: {username}, IP: {ip_address}, Attempts: {attempts}',
            extra={
                'username': username,
                'ip_address': ip_address,
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'attempts': attempts,
                'event_type': 'auth_failure'
            }
        )
        
        if is_locked:
            minutes_remaining = remaining_time // 60
            return Response(
                {
                    'error': f'Too many failed login attempts. Account locked for {minutes_remaining} minutes.'
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        else:
            return Response(
                {
                    'error': 'Invalid credentials',
                    'remaining_attempts': remaining_attempts
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    # Clear failed attempts on successful login
    clear_failed_attempts(username)
    
    # Log successful authentication
    logger.info(
        f'Successful login - Username: {username}, IP: {ip_address}',
        extra={
            'username': username,
            'user_id': user.id,
            'ip_address': ip_address,
            'event_type': 'auth_success'
        }
    )
    
    # Create a Django user wrapper for JWT token generation
    # This is needed because JWT expects a Django User model
    django_user, created = DjangoUser.objects.get_or_create(
        username=username,
        defaults={'email': user.email}
    )
    
    # Generate JWT tokens using the Django user
    refresh = RefreshToken.for_user(django_user)
    
    # Add custom claims with the actual custom User ID
    refresh['custom_user_id'] = user.id
    refresh['role'] = user.role
    
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    
    # Serialize user data
    user_data = UserSerializer(user).data
    
    return Response({
        'token': access_token,
        'refresh': refresh_token,
        'user': user_data,
        'role': user.role
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='10/h', method='POST', block=True)
def register_view(request):
    """
    Register a new user.
    POST /api/auth/register
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user = serializer.save()
    user_data = UserSerializer(user).data
    
    return Response({
        'user': user_data,
        'is_approved': user.is_approved,
        'message': 'Registration successful. Awaiting approval.'
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint that invalidates the refresh token.
    POST /api/auth/logout
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response({
            'message': 'Logout successful'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'error': 'Invalid token'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """
    Get current user profile with related data.
    GET /api/auth/profile
    """
    # Get user from custom User model with settings
    try:
        # Use username for lookup to handle ID mismatches between Django and custom User models
        user = User.objects.select_related('settings').get(username=request.user.username)
        user_data = UserSerializer(user).data
        return Response(user_data, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({
            'error': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh_view(request):
    """
    Refresh access token using refresh token.
    POST /api/auth/refresh
    """
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({
                'error': 'Refresh token required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token = RefreshToken(refresh_token)
        access_token = str(token.access_token)
        
        return Response({
            'token': access_token
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'error': 'Invalid refresh token'
        }, status=status.HTTP_401_UNAUTHORIZED)



@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_settings_view(request):
    """
    Get or update current user's settings.
    GET /api/settings
    PUT /api/settings
    """
    try:
        # Use username for lookup to handle ID mismatches
        user = User.objects.select_related('settings').get(username=request.user.username)
    except User.DoesNotExist:
        return Response({
            'error': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        # Try to get from cache
        cache_key = generate_cache_key('user:settings', user_id=user.id)
        cached_settings = get_cached_data(cache_key)
        
        if cached_settings is not None:
            return Response(cached_settings, status=status.HTTP_200_OK)
        
        # Get or create user settings
        settings, created = UserSettings.objects.get_or_create(
            user=user,
            defaults={
                'email_alerts': True,
                'push_notifications': True,
                'activity_updates': True,
                'dark_mode': False,
                'compact_mode': False,
                'primary_color': 'blue',
            }
        )
        
        serializer = UserSettingsSerializer(settings)
        
        # Cache the response
        set_cached_data(cache_key, serializer.data, 300)  # 5 minutes TTL
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        # Get or create user settings
        settings, created = UserSettings.objects.get_or_create(
            user=user,
            defaults={
                'email_alerts': True,
                'push_notifications': True,
                'activity_updates': True,
                'dark_mode': False,
                'compact_mode': False,
                'primary_color': 'blue',
            }
        )
        
        # Update settings
        serializer = UserSettingsSerializer(settings, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        # Invalidate cache
        cache_key = generate_cache_key('user:settings', user_id=user.id)
        delete_cached_data(cache_key)
        
        return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_settings_reset_view(request):
    """
    Reset user settings to defaults.
    POST /api/settings/reset
    """
    try:
        # Use username for lookup to handle ID mismatches
        user = User.objects.get(username=request.user.username)
    except User.DoesNotExist:
        return Response({
            'error': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Get or create user settings
    settings, created = UserSettings.objects.get_or_create(user=user)
    
    # Reset to defaults
    settings.email_alerts = True
    settings.push_notifications = True
    settings.activity_updates = True
    settings.dark_mode = False
    settings.compact_mode = False
    settings.primary_color = 'blue'
    settings.custom_bg = None
    settings.save()
    
    # Invalidate cache
    cache_key = generate_cache_key('user:settings', user_id=user.id)
    delete_cached_data(cache_key)
    
    serializer = UserSettingsSerializer(settings)
    return Response({
        'message': 'Settings reset to defaults',
        'settings': serializer.data
    }, status=status.HTTP_200_OK)
