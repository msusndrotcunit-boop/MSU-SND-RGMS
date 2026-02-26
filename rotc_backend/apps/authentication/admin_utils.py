"""
Admin utility functions
"""

def is_admin_user(user):
    """
    Check if user is an admin (either superuser or has admin role)
    """
    # Check if user is Django superuser (for initial setup)
    if hasattr(user, 'is_superuser') and user.is_superuser:
        return True
    
    # Check if user has admin role in our custom User model
    if hasattr(user, 'role') and user.role == 'admin':
        return True
    
    return False
