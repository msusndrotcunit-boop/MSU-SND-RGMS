"""
Create Trae Training Staff Account - NO AUTH REQUIRED
Creates both User and TrainingStaff records for Trae
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from apps.authentication.models import User
from apps.staff.models import TrainingStaff
import bcrypt


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def create_trae_account(request):
    """
    Create training staff account for Trae.
    Access via: /api/create-trae-account
    
    Optional POST body to customize:
    {
        "username": "trae",
        "email": "trae@example.com",
        "first_name": "Trae",
        "last_name": "Staff",
        "rank": "Sergeant"
    }
    """
    try:
        # Get data from request or use defaults
        data = request.data if request.method == 'POST' else {}
        
        username = data.get('username', 'trae')
        email = data.get('email', 'trae@msu-snd-rotc.edu')
        password = data.get('password', 'trae2026')  # Default password
        first_name = data.get('first_name', 'Trae')
        last_name = data.get('last_name', 'Training Staff')
        rank = data.get('rank', 'Staff Sergeant')
        
        # Hash the password using bcrypt
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Step 1: Create or update TrainingStaff record
        staff, staff_created = TrainingStaff.objects.update_or_create(
            email=email,
            defaults={
                'first_name': first_name,
                'last_name': last_name,
                'rank': rank,
                'is_profile_completed': True,
                'is_archived': False,
                'rotc_unit': 'MSU-SND ROTC Unit',
            }
        )
        
        # Step 2: Create or update User record
        user, user_created = User.objects.update_or_create(
            username=username,
            defaults={
                'email': email,
                'password': hashed_password,
                'role': 'training_staff',
                'is_approved': True,
                'staff_id': staff.id
            }
        )
        
        # Test password verification
        test_password_bytes = password.encode('utf-8')
        test_hash_bytes = user.password.encode('utf-8')
        password_works = bcrypt.checkpw(test_password_bytes, test_hash_bytes)
        
        return Response({
            'success': True,
            'message': f'Training staff account for {first_name} {last_name} {"created" if user_created else "updated"} successfully!',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'is_approved': user.is_approved,
                'staff_id': user.staff_id,
                'created': user_created
            },
            'staff': {
                'id': staff.id,
                'first_name': staff.first_name,
                'last_name': staff.last_name,
                'rank': staff.rank,
                'email': staff.email,
                'created': staff_created
            },
            'credentials': {
                'username': username,
                'password': password,
                'password_verification': password_works
            },
            'login_instructions': {
                'step1': 'Go to the login page',
                'step2': 'Select "Staff" tab',
                'step3': f'Enter username: {username}',
                'step4': 'No password required for staff login',
                'note': 'Staff login uses identifier-only authentication'
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        return Response({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'message': 'Failed to create Trae account'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
