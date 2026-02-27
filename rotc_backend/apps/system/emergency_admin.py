"""
Emergency admin creation - NO AUTH REQUIRED
WARNING: Remove this file after initial setup!
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from apps.authentication.models import User
from apps.authentication.lockout import unlock_account
import bcrypt


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def emergency_create_admin(request):
    """
    EMERGENCY: Create admin account without authentication.
    WARNING: This endpoint has NO SECURITY. Remove after use!
    
    Access via: /api/emergency-admin
    """
    username = 'msu-sndrotc_admin'
    password = 'admingrading@2026'
    email = 'msusndrotcunit@gmail.com'
    
    try:
        # Unlock account first
        unlock_account(username)
        
        # Hash the password using bcrypt
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Delete existing user if exists
        try:
            existing_user = User.objects.get(username=username)
            existing_user.delete()
            action = 'deleted_and_recreated'
        except User.DoesNotExist:
            action = 'created_new'
        
        # Create new admin user
        user = User.objects.create(
            username=username,
            email=email,
            password=hashed_password,
            role='admin',
            is_approved=True
        )
        
        # Test password verification
        test_password_bytes = password.encode('utf-8')
        test_hash_bytes = user.password.encode('utf-8')
        password_works = bcrypt.checkpw(test_password_bytes, test_hash_bytes)
        
        return Response({
            'success': True,
            'message': 'EMERGENCY: Admin account created!',
            'username': username,
            'password': password,
            'email': email,
            'user_id': user.id,
            'role': user.role,
            'is_approved': user.is_approved,
            'password_verification': password_works,
            'action': action,
            'WARNING': 'This endpoint has NO SECURITY! Remove /api/emergency-admin after login works!'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to create admin account'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
