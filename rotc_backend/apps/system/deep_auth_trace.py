"""
Deep Authentication Trace - Traces the complete auth flow
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from django.contrib.auth.models import User as DjangoUser
from django.contrib.auth import authenticate
from django.conf import settings
from apps.authentication.models import User
from apps.authentication.backends import BcryptAuthenticationBackend
import bcrypt
import os


@api_view(['POST'])
@permission_classes([AllowAny])
def deep_auth_trace(request):
    """
    Deep trace of the authentication flow to find the exact issue.
    POST /api/deep-auth-trace
    Body: { "username": "msu-sndrotc_admin", "password": "admingrading@2026" }
    """
    try:
        username = request.data.get('username', 'msu-sndrotc_admin')
        password = request.data.get('password', 'admingrading@2026')
        
        trace = {}
        
        # STEP 1: Check custom user exists
        try:
            custom_user = User.objects.get(username=username)
            trace['step1_custom_user'] = {
                'exists': True,
                'id': custom_user.id,
                'username': custom_user.username,
                'email': custom_user.email,
                'role': custom_user.role,
                'is_approved': custom_user.is_approved,
                'password_hash_prefix': custom_user.password[:20] + '...'
            }
        except User.DoesNotExist:
            return Response({
                'error': 'Custom user not found',
                'username': username,
                'trace': trace
            }, status=status.HTTP_404_NOT_FOUND)
        
        # STEP 2: Test password verification directly
        try:
            password_bytes = password.encode('utf-8')
            hash_bytes = custom_user.password.encode('utf-8')
            password_valid = bcrypt.checkpw(password_bytes, hash_bytes)
            trace['step2_password_check'] = {
                'valid': password_valid,
                'method': 'bcrypt.checkpw'
            }
        except Exception as e:
            trace['step2_password_check'] = {
                'valid': False,
                'error': str(e)
            }
        
        # STEP 3: Test authentication backend
        backend = BcryptAuthenticationBackend()
        auth_user = backend.authenticate(request, username=username, password=password)
        trace['step3_backend_auth'] = {
            'success': auth_user is not None,
            'user_id': auth_user.id if auth_user else None,
            'username': auth_user.username if auth_user else None
        }
        
        # STEP 4: Test Django's authenticate() function
        django_auth_user = authenticate(request, username=username, password=password)
        trace['step4_django_authenticate'] = {
            'success': django_auth_user is not None,
            'user_id': django_auth_user.id if django_auth_user else None,
            'username': django_auth_user.username if django_auth_user else None,
            'user_type': type(django_auth_user).__name__ if django_auth_user else None
        }
        
        if not django_auth_user:
            return Response({
                'error': 'Authentication failed',
                'trace': trace
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # STEP 5: Check Django User table
        django_users = list(DjangoUser.objects.filter(username=username).values('id', 'username', 'email'))
        trace['step5_django_user_table'] = {
            'count': len(django_users),
            'users': django_users
        }
        
        # STEP 6: Create or get Django user for JWT
        django_user, created = DjangoUser.objects.get_or_create(
            username=username,
            defaults={'email': custom_user.email}
        )
        trace['step6_django_user_for_jwt'] = {
            'created': created,
            'id': django_user.id,
            'username': django_user.username,
            'email': django_user.email
        }
        
        # STEP 7: Check secret keys
        env_secret_key = os.environ.get('SECRET_KEY', 'NOT_SET')
        env_django_secret_key = os.environ.get('DJANGO_SECRET_KEY', 'NOT_SET')
        django_secret_key = settings.SECRET_KEY
        jwt_signing_key = settings.SIMPLE_JWT.get('SIGNING_KEY', 'NOT_SET')
        
        def mask_key(key):
            if key == 'NOT_SET' or len(key) < 20:
                return key
            return f"{key[:10]}...{key[-4:]}"
        
        trace['step7_secret_keys'] = {
            'env_SECRET_KEY': mask_key(env_secret_key),
            'env_DJANGO_SECRET_KEY': mask_key(env_django_secret_key),
            'django_SECRET_KEY': mask_key(django_secret_key),
            'jwt_SIGNING_KEY': mask_key(jwt_signing_key),
            'keys_match': django_secret_key == jwt_signing_key,
            'signing_key_source': 'DJANGO_SECRET_KEY' if env_django_secret_key != 'NOT_SET' else 'SECRET_KEY'
        }
        
        # STEP 8: Create JWT token (same as login view)
        refresh = RefreshToken.for_user(django_user)
        refresh['custom_user_id'] = custom_user.id
        refresh['role'] = custom_user.role
        
        access_token_str = str(refresh.access_token)
        refresh_token_str = str(refresh)
        
        trace['step8_token_creation'] = {
            'access_token_length': len(access_token_str),
            'refresh_token_length': len(refresh_token_str),
            'access_token_preview': access_token_str[:50] + '...',
            'custom_claims': {
                'custom_user_id': custom_user.id,
                'role': custom_user.role
            }
        }
        
        # STEP 9: Immediately validate the token
        try:
            decoded_token = AccessToken(access_token_str)
            token_payload = dict(decoded_token.payload)
            trace['step9_immediate_validation'] = {
                'valid': True,
                'payload': token_payload,
                'user_id_in_token': token_payload.get('user_id'),
                'custom_user_id_in_token': token_payload.get('custom_user_id'),
                'role_in_token': token_payload.get('role')
            }
        except Exception as e:
            trace['step9_immediate_validation'] = {
                'valid': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
        
        # STEP 10: Test token with JWTAuthentication
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework.request import Request
        from django.http import HttpRequest
        
        # Create a mock request with the token
        mock_http_request = HttpRequest()
        mock_http_request.META = {
            'HTTP_AUTHORIZATION': f'Bearer {access_token_str}'
        }
        mock_request = Request(mock_http_request)
        
        jwt_auth = JWTAuthentication()
        try:
            auth_result = jwt_auth.authenticate(mock_request)
            if auth_result:
                validated_user, validated_token = auth_result
                trace['step10_jwt_authentication'] = {
                    'success': True,
                    'user_id': validated_user.id,
                    'username': validated_user.username,
                    'user_type': type(validated_user).__name__,
                    'token_type': type(validated_token).__name__
                }
            else:
                trace['step10_jwt_authentication'] = {
                    'success': False,
                    'error': 'authenticate() returned None'
                }
        except Exception as e:
            trace['step10_jwt_authentication'] = {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
        
        # STEP 11: Check if custom user can be found from Django user
        try:
            custom_user_from_django = User.objects.get(username=django_user.username)
            trace['step11_custom_user_lookup'] = {
                'success': True,
                'custom_user_id': custom_user_from_django.id,
                'matches_original': custom_user_from_django.id == custom_user.id
            }
        except User.DoesNotExist:
            trace['step11_custom_user_lookup'] = {
                'success': False,
                'error': 'Custom user not found by Django username'
            }
        
        # FINAL SUMMARY
        all_steps_passed = all([
            trace['step2_password_check']['valid'],
            trace['step3_backend_auth']['success'],
            trace['step4_django_authenticate']['success'],
            trace['step7_secret_keys']['keys_match'],
            trace['step9_immediate_validation']['valid'],
            trace['step10_jwt_authentication']['success'],
            trace['step11_custom_user_lookup']['success']
        ])
        
        return Response({
            'overall_status': 'SUCCESS' if all_steps_passed else 'FAILED',
            'message': 'All authentication steps passed' if all_steps_passed else 'One or more steps failed',
            'trace': trace,
            'token_for_testing': access_token_str if all_steps_passed else None
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        return Response({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'trace': trace if 'trace' in locals() else {}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
