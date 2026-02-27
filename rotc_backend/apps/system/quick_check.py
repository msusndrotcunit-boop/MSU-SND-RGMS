"""
Quick check endpoint - minimal diagnostic
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.authentication.models import User
import os


@api_view(['GET'])
@permission_classes([AllowAny])
def quick_check(request):
    """
    Quick check - does admin user exist?
    Access via: /api/quick-check?key=YOUR_SECRET_KEY
    """
    provided_key = request.GET.get('key')
    actual_secret_key = os.getenv('SECRET_KEY', '')
    
    if not provided_key or provided_key != actual_secret_key:
        return Response({'error': 'Unauthorized'}, status=401)
    
    username = 'msu-sndrotc_admin'
    
    try:
        user = User.objects.get(username=username)
        return Response({
            'user_exists': True,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'is_approved': user.is_approved,
            'has_password': bool(user.password),
            'password_length': len(user.password) if user.password else 0,
            'message': 'User exists - you can try logging in'
        })
    except User.DoesNotExist:
        return Response({
            'user_exists': False,
            'username_searched': username,
            'message': 'User does NOT exist - visit /api/setup-admin first',
            'setup_url': f'/api/setup-admin?key={provided_key}'
        })
