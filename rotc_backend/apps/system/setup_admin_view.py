"""
Setup admin account endpoint - for initial deployment setup only.
This endpoint creates the admin account when accessed with the correct secret key.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from apps.authentication.models import User
import bcrypt
import os


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def setup_admin_account(request):
    """
    Create or reset the admin account.
    Requires SECRET_KEY environment variable to match for security.
    
    Access via: /api/setup-admin?key=YOUR_SECRET_KEY
    """
    # Get the secret key from query params or request body
    provided_key = request.GET.get('key') or request.data.get('key')
    
    # Get the actual secret key from environment
    actual_secret_key = os.getenv('SECRET_KEY', '')
    
    # Verify the key
    if not provided_key or provided_key != actual_secret_key:
        return Response(
            {
                'error': 'Unauthorized',
                'message': 'Invalid or missing secret key'
            },
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Admin credentials
    username = 'msu-sndrotc_admin'
    password = 'admingrading@2026'
    email = 'admin@msu-snd-rotc.edu'
    
    try:
        # Hash the password using bcrypt
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Check if admin user already exists
        try:
            user = User.objects.get(username=username)
            # Update existing user
            user.password = hashed_password
            user.email = email
            user.role = 'admin'
            user.is_approved = True
            user.save()
            
            return Response({
                'success': True,
                'message': 'Admin account updated successfully!',
                'username': username,
                'email': email,
                'role': user.role,
                'is_approved': user.is_approved,
                'action': 'updated'
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            # Create new admin user
            user = User.objects.create(
                username=username,
                email=email,
                password=hashed_password,
                role='admin',
                is_approved=True
            )
            
            return Response({
                'success': True,
                'message': 'Admin account created successfully!',
                'username': username,
                'email': email,
                'role': user.role,
                'is_approved': user.is_approved,
                'action': 'created'
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to create/update admin account'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
