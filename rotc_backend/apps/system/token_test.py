"""
Token Test Endpoint - Tests the complete JWT flow
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User as DjangoUser
from django.conf import settings
from apps.authentication.models import User
import os


@api_view(['POST'])
@permission_classes([AllowAny])
def test_token_flow(request):
    """
    Test the complete JWT token creation and validation flow.
    POST /api/test-token-flow
    Body: { "username": "msu-sndrotc_admin" }
    """
    try:
        username = request.data.get('username', 'msu-sndrotc_admin')
        
        # Step 1: Get custom user
        try:
            custom_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({
                'error': 'Custom user not found',
                'username': username
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Step 2: Get or create Django user
        django_user, created = DjangoUser.objects.get_or_create(
            username=username,
            defaults={'email': custom_user.email}
        )
        
        # Step 3: Get secret keys
        env_secret_key = os.environ.get('SECRET_KEY', 'NOT_SET')
        env_django_secret_key = os.environ.get('DJANGO_SECRET_KEY', 'NOT_SET')
        django_secret_key = settings.SECRET_KEY
        jwt_signing_key = settings.SIMPLE_JWT.get('SIGNING_KEY', 'NOT_SET')
        
        # Step 4: Create JWT token
        refresh = RefreshToken.for_user(django_user)
        refresh['custom_user_id'] = custom_user.id
        refresh['role'] = custom_user.role
        
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        # Step 5: Try to decode the token immediately
        from rest_framework_simplejwt.tokens import AccessToken
        try:
            decoded_token = AccessToken(access_token)
            token_valid = True
            token_error = None
            token_payload = dict(decoded_token.payload)
        except Exception as e:
            token_valid = False
            token_error = str(e)
            token_payload = None
        
        # Mask keys for security
        def mask_key(key):
            if key == 'NOT_SET' or len(key) < 20:
                return key
            return f"{key[:10]}...{key[-4:]}"
        
        return Response({
            'step1_custom_user': {
                'found': True,
                'id': custom_user.id,
                'username': custom_user.username,
                'role': custom_user.role,
                'is_approved': custom_user.is_approved
            },
            'step2_django_user': {
                'found': True,
                'created': created,
                'id': django_user.id,
                'username': django_user.username
            },
            'step3_secret_keys': {
                'env_SECRET_KEY': mask_key(env_secret_key),
                'env_DJANGO_SECRET_KEY': mask_key(env_django_secret_key),
                'django_SECRET_KEY': mask_key(django_secret_key),
                'jwt_SIGNING_KEY': mask_key(jwt_signing_key),
                'keys_match': django_secret_key == jwt_signing_key
            },
            'step4_token_creation': {
                'access_token': access_token[:50] + '...',
                'refresh_token': refresh_token[:50] + '...',
                'token_length': len(access_token)
            },
            'step5_immediate_validation': {
                'valid': token_valid,
                'error': token_error,
                'payload': token_payload
            },
            'overall_status': 'SUCCESS' if token_valid else 'FAILED',
            'message': 'Token created and validated successfully' if token_valid else f'Token validation failed: {token_error}'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        return Response({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'message': 'Token flow test failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
