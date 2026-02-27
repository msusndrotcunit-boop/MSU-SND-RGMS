"""
Test authentication endpoint to debug request.user.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_auth_endpoint(request):
    """
    Test endpoint to see what request.user contains.
    """
    user = request.user
    
    return Response({
        'authenticated': request.user.is_authenticated if hasattr(request.user, 'is_authenticated') else False,
        'user_type': type(user).__name__,
        'user_id': user.id if hasattr(user, 'id') else None,
        'username': user.username if hasattr(user, 'username') else None,
        'user_model': f"{user.__class__.__module__}.{user.__class__.__name__}",
        'has_role': hasattr(user, 'role'),
        'role': user.role if hasattr(user, 'role') else None,
        'user_str': str(user),
        'user_dict': {
            'id': getattr(user, 'id', None),
            'username': getattr(user, 'username', None),
            'email': getattr(user, 'email', None),
            'role': getattr(user, 'role', None),
        }
    }, status=status.HTTP_200_OK)
