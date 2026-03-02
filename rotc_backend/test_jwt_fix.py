#!/usr/bin/env python3
"""
Test JWT Fix - Simple verification that JWT tokens work with the secure key.
"""
import os
import sys
import django

# Set the secure key
os.environ['DJANGO_SECRET_KEY'] = 'IhmJU6c2p!9(hWO&s3ISA*Xi5ttUJU)9HFxq(QOJ8UDd8a@3j!'

# Setup Django with development settings (no database required)
sys.path.append('/opt/render/project/src/rotc_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

django.setup()

from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from django.contrib.auth.models import User as DjangoUser
from django.conf import settings
import jwt

def test_jwt_generation():
    """Test JWT token generation and validation."""
    print("🔧 Testing JWT Token Generation and Validation")
    print(f"Using SECRET_KEY: {settings.SECRET_KEY[:10]}...")
    
    # Create a test user (in memory, no database)
    test_user = DjangoUser(id=1, username='test_admin')
    
    try:
        # Generate tokens
        refresh = RefreshToken.for_user(test_user)
        refresh['custom_user_id'] = 1
        refresh['role'] = 'admin'
        
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        print(f"✅ Token generation successful")
        print(f"   Access token length: {len(access_token)}")
        print(f"   Refresh token length: {len(refresh_token)}")
        
        # Test validation with AccessToken class
        try:
            validated_token = AccessToken(access_token)
            print("✅ AccessToken validation successful")
            print(f"   User ID: {validated_token['user_id']}")
            print(f"   Custom User ID: {validated_token.get('custom_user_id')}")
            print(f"   Role: {validated_token.get('role')}")
        except Exception as e:
            print(f"❌ AccessToken validation failed: {e}")
            return False
        
        # Test validation with PyJWT
        try:
            decoded = jwt.decode(
                access_token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            print("✅ PyJWT validation successful")
            print(f"   Decoded payload keys: {list(decoded.keys())}")
        except Exception as e:
            print(f"❌ PyJWT validation failed: {e}")
            return False
        
        print("\n🎉 JWT FIX VERIFICATION SUCCESSFUL!")
        print("✅ Token generation working")
        print("✅ Token validation working")
        print("✅ Secure SECRET_KEY in use")
        
        return True
        
    except Exception as e:
        print(f"❌ JWT test failed: {e}")
        return False

if __name__ == '__main__':
    success = test_jwt_generation()
    if success:
        print("\n📋 NEXT STEPS:")
        print("1. Update DJANGO_SECRET_KEY in Render environment")
        print("2. Redeploy the service")
        print("3. Clear browser localStorage")
        print("4. Test login at https://msu-snd-rgms-1.onrender.com/login")
    else:
        print("\n❌ JWT fix verification failed")
        sys.exit(1)