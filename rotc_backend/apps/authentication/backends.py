"""
Custom authentication backend for bcrypt password hashing.
Compatible with Node.js bcryptjs library.
"""
import bcrypt
from django.contrib.auth.hashers import BasePasswordHasher
from apps.authentication.models import User


class BcryptPasswordHasher(BasePasswordHasher):
    """
    Custom password hasher using bcrypt.
    Compatible with bcryptjs from Node.js backend.
    """
    algorithm = "bcrypt"
    library = "bcrypt"

    def encode(self, password, salt=None):
        """
        Hash a password using bcrypt with default work factor of 10.
        """
        bcrypt_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=10))
        return bcrypt_hash.decode('utf-8')

    def verify(self, password, encoded):
        """
        Verify a password against a bcrypt hash.
        """
        return bcrypt.checkpw(password.encode('utf-8'), encoded.encode('utf-8'))

    def safe_summary(self, encoded):
        """
        Return a summary of the password hash for display purposes.
        """
        return {
            'algorithm': self.algorithm,
            'hash': encoded[:10] + '...',
        }


class BcryptAuthenticationBackend:
    """
    Custom authentication backend that uses bcrypt for password verification.
    """
    
    def authenticate(self, request, username=None, password=None):
        """
        Authenticate a user with username and password using bcrypt.
        """
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return None
        
        # Verify password using bcrypt
        if bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            return user
        
        return None
    
    def get_user(self, user_id):
        """
        Get a user by ID.
        """
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
