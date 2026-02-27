"""
Deep diagnostic tool for admin login issues.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from apps.authentication.models import User
from apps.authentication.lockout import is_account_locked, get_remaining_attempts
from django.core.cache import cache
import bcrypt
import os


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def admin_diagnostic(request):
    """
    Deep diagnostic for admin login issues.
    Requires SECRET_KEY environment variable to match for security.
    
    Access via: /api/admin-diagnostic?key=YOUR_SECRET_KEY
    """
    # Get the secret key from query params or request body
    provided_key = request.GET.get('key') or request.data.get('key')
    
    # Get the actual secret key from environment
    actual_secret_key = os.getenv('SECRET_KEY') or os.getenv('DJANGO_SECRET_KEY', '')
    
    # Verify the key
    if not provided_key or provided_key != actual_secret_key:
        return Response(
            {
                'error': 'Unauthorized',
                'message': 'Invalid or missing secret key'
            },
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    username = 'msu-sndrotc_admin'
    password = 'admingrading@2026'
    
    diagnostic_results = {
        'timestamp': str(__import__('datetime').datetime.now()),
        'checks': {}
    }
    
    # Check 1: Does user exist in database?
    try:
        user = User.objects.get(username=username)
        diagnostic_results['checks']['user_exists'] = {
            'status': 'PASS',
            'message': f'User {username} exists in database',
            'details': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'is_approved': user.is_approved,
                'created_at': str(user.created_at) if hasattr(user, 'created_at') else 'N/A'
            }
        }
        
        # Check 2: Password hash format
        stored_hash = user.password
        diagnostic_results['checks']['password_hash'] = {
            'status': 'INFO',
            'message': 'Password hash stored',
            'details': {
                'hash_length': len(stored_hash),
                'hash_prefix': stored_hash[:10] if len(stored_hash) > 10 else stored_hash,
                'looks_like_bcrypt': stored_hash.startswith('$2') if stored_hash else False
            }
        }
        
        # Check 3: Test password verification
        try:
            password_bytes = password.encode('utf-8')
            stored_hash_bytes = stored_hash.encode('utf-8')
            password_matches = bcrypt.checkpw(password_bytes, stored_hash_bytes)
            
            diagnostic_results['checks']['password_verification'] = {
                'status': 'PASS' if password_matches else 'FAIL',
                'message': 'Password matches' if password_matches else 'Password does NOT match',
                'details': {
                    'test_password': password,
                    'verification_result': password_matches
                }
            }
        except Exception as e:
            diagnostic_results['checks']['password_verification'] = {
                'status': 'ERROR',
                'message': f'Password verification failed: {str(e)}',
                'details': {'error': str(e)}
            }
        
        # Check 4: Account lockout status
        is_locked, remaining_time = is_account_locked(username)
        remaining_attempts = get_remaining_attempts(username)
        
        diagnostic_results['checks']['account_lockout'] = {
            'status': 'FAIL' if is_locked else 'PASS',
            'message': f'Account is {"LOCKED" if is_locked else "NOT LOCKED"}',
            'details': {
                'is_locked': is_locked,
                'remaining_time_seconds': remaining_time,
                'remaining_attempts': remaining_attempts
            }
        }
        
        # Check 5: User role and approval
        diagnostic_results['checks']['user_permissions'] = {
            'status': 'PASS' if user.role == 'admin' and user.is_approved else 'FAIL',
            'message': f'Role: {user.role}, Approved: {user.is_approved}',
            'details': {
                'role': user.role,
                'is_admin': user.role == 'admin',
                'is_approved': user.is_approved,
                'expected_role': 'admin',
                'expected_approved': True
            }
        }
        
        # Check 6: Cache connectivity
        try:
            cache.set('diagnostic_test', 'ok', 10)
            cache_works = cache.get('diagnostic_test') == 'ok'
            diagnostic_results['checks']['cache_connectivity'] = {
                'status': 'PASS' if cache_works else 'FAIL',
                'message': 'Cache is working' if cache_works else 'Cache is NOT working',
                'details': {'cache_test': cache_works}
            }
        except Exception as e:
            diagnostic_results['checks']['cache_connectivity'] = {
                'status': 'ERROR',
                'message': f'Cache error: {str(e)}',
                'details': {'error': str(e)}
            }
        
        # Check 7: Authentication backend test
        from apps.authentication.backends import BcryptAuthenticationBackend
        backend = BcryptAuthenticationBackend()
        
        try:
            authenticated_user = backend.authenticate(request, username=username, password=password)
            
            diagnostic_results['checks']['authentication_backend'] = {
                'status': 'PASS' if authenticated_user else 'FAIL',
                'message': 'Backend authentication successful' if authenticated_user else 'Backend authentication FAILED',
                'details': {
                    'authenticated': authenticated_user is not None,
                    'returned_user_id': authenticated_user.id if authenticated_user else None
                }
            }
        except Exception as e:
            diagnostic_results['checks']['authentication_backend'] = {
                'status': 'ERROR',
                'message': f'Backend authentication error: {str(e)}',
                'details': {'error': str(e)}
            }
        
    except User.DoesNotExist:
        diagnostic_results['checks']['user_exists'] = {
            'status': 'FAIL',
            'message': f'User {username} does NOT exist in database',
            'details': {
                'username_searched': username,
                'action_needed': 'Visit /api/setup-admin to create the user'
            }
        }
        
        # Count total users
        total_users = User.objects.count()
        admin_users = User.objects.filter(role='admin').count()
        
        diagnostic_results['checks']['database_info'] = {
            'status': 'INFO',
            'message': f'Total users: {total_users}, Admin users: {admin_users}',
            'details': {
                'total_users': total_users,
                'admin_users': admin_users
            }
        }
    
    except Exception as e:
        diagnostic_results['checks']['database_error'] = {
            'status': 'ERROR',
            'message': f'Database error: {str(e)}',
            'details': {'error': str(e)}
        }
    
    # Summary
    failed_checks = [k for k, v in diagnostic_results['checks'].items() if v['status'] == 'FAIL']
    error_checks = [k for k, v in diagnostic_results['checks'].items() if v['status'] == 'ERROR']
    
    diagnostic_results['summary'] = {
        'total_checks': len(diagnostic_results['checks']),
        'failed_checks': len(failed_checks),
        'error_checks': len(error_checks),
        'failed_check_names': failed_checks,
        'error_check_names': error_checks,
        'overall_status': 'HEALTHY' if len(failed_checks) == 0 and len(error_checks) == 0 else 'ISSUES_FOUND'
    }
    
    return Response(diagnostic_results, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def force_fix_admin(request):
    """
    Force fix admin account - recreate with correct settings and unlock.
    Requires SECRET_KEY environment variable to match for security.
    
    Access via: POST /api/force-fix-admin?key=YOUR_SECRET_KEY
    """
    # Get the secret key from query params or request body
    provided_key = request.GET.get('key') or request.data.get('key')
    
    # Get the actual secret key from environment
    actual_secret_key = os.getenv('SECRET_KEY') or os.getenv('DJANGO_SECRET_KEY', '')
    
    # Verify the key
    if not provided_key or provided_key != actual_secret_key:
        return Response(
            {
                'error': 'Unauthorized',
                'message': 'Invalid or missing secret key'
            },
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    username = 'msu-sndrotc_admin'
    password = 'admingrading@2026'
    email = 'msusndrotcunit@gmail.com'
    
    actions_taken = []
    
    try:
        # Step 1: Unlock account
        from apps.authentication.lockout import unlock_account
        unlock_account(username)
        actions_taken.append('Unlocked account')
        
        # Step 2: Delete existing user if exists
        try:
            existing_user = User.objects.get(username=username)
            existing_user.delete()
            actions_taken.append(f'Deleted existing user (ID: {existing_user.id})')
        except User.DoesNotExist:
            actions_taken.append('No existing user to delete')
        
        # Step 3: Create fresh password hash
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        actions_taken.append('Generated new password hash')
        
        # Step 4: Create new user
        user = User.objects.create(
            username=username,
            email=email,
            password=hashed_password,
            role='admin',
            is_approved=True
        )
        actions_taken.append(f'Created new user (ID: {user.id})')
        
        # Step 5: Verify password works
        test_password_bytes = password.encode('utf-8')
        test_hash_bytes = user.password.encode('utf-8')
        password_works = bcrypt.checkpw(test_password_bytes, test_hash_bytes)
        actions_taken.append(f'Password verification: {"SUCCESS" if password_works else "FAILED"}')
        
        # Step 6: Clear any cache entries
        cache.delete(f'lockout:attempts:{username}')
        cache.delete(f'lockout:time:{username}')
        actions_taken.append('Cleared cache entries')
        
        return Response({
            'success': True,
            'message': 'Admin account force-fixed successfully!',
            'username': username,
            'email': email,
            'user_id': user.id,
            'role': user.role,
            'is_approved': user.is_approved,
            'password_verification': password_works,
            'actions_taken': actions_taken
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to force-fix admin account',
            'actions_taken': actions_taken
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
