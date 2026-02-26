"""
Custom permission classes for role-based access control.
"""
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Permission class that allows access only to admin users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated, approved, and has admin role."""
        return (
            request.user and
            hasattr(request, 'auth_user') and
            request.auth_user.is_approved and
            request.auth_user.role == 'admin'
        )


class IsCadet(permissions.BasePermission):
    """
    Permission class that allows access only to cadet users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated, approved, and has cadet role."""
        return (
            request.user and
            hasattr(request, 'auth_user') and
            request.auth_user.is_approved and
            request.auth_user.role == 'cadet'
        )


class IsTrainingStaff(permissions.BasePermission):
    """
    Permission class that allows access only to training staff users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated, approved, and has training_staff role."""
        return (
            request.user and
            hasattr(request, 'auth_user') and
            request.auth_user.is_approved and
            request.auth_user.role == 'training_staff'
        )


class IsApproved(permissions.BasePermission):
    """
    Permission class that allows access only to approved users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and approved."""
        return (
            request.user and
            hasattr(request, 'auth_user') and
            request.auth_user.is_approved
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission class that allows read access to all authenticated users,
    but write access only to admins.
    """
    
    def has_permission(self, request, view):
        """Check permissions based on request method."""
        if request.method in permissions.SAFE_METHODS:
            return request.user and hasattr(request, 'auth_user')
        
        return (
            request.user and
            hasattr(request, 'auth_user') and
            request.auth_user.is_approved and
            request.auth_user.role == 'admin'
        )


class IsAdminOrTrainingStaff(permissions.BasePermission):
    """
    Permission class that allows access to admin or training staff users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated, approved, and has admin or training_staff role."""
        return (
            request.user and
            hasattr(request, 'auth_user') and
            request.auth_user.is_approved and
            request.auth_user.role in ['admin', 'training_staff']
        )
