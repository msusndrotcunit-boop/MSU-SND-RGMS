from rest_framework.permissions import BasePermission

class RolePermission(BasePermission):
    def __init__(self, required_roles=None):
        self.required_roles = set(required_roles or [])

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = None
        try:
            if isinstance(request.auth, dict):
                role = (request.auth.get('role') or '').lower()
        except Exception:
            role = None
        if not role and request.user.username:
            uname = request.user.username
            if uname.startswith('staff:'):
                role = 'training_staff'
            elif uname.startswith('cadet:'):
                role = 'cadet'
            else:
                role = 'admin'
        if not self.required_roles:
            return True
        return role in self.required_roles
