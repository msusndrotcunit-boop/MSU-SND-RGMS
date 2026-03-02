#!/usr/bin/env python3
"""
JWT Token Signature Diagnostic Tool
Comprehensive analysis of JWT token signature validation issues.
"""
import os
import sys
import django
from datetime import datetime, timedelta
import json

# Setup Django
sys.path.append('/opt/render/project/src/rotc_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth.models import User as DjangoUser
from apps.authentication.models import User
from django.conf import settings
import jwt
import bcrypt

def print_section(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")

def print_subsection(title):
    print(f"\n{'-'*40}")
    print(f" {title}")
    print(f"{'-'*40}")

def main():
    print_section("JWT TOKEN SIGNATURE DIAGNOSTIC")
    
    # 1. Environment Analysis
    print_subsection("Environment Configuration")
    
    # Check SECRET_KEY sources
    django_secret = os.environ.get('DJANGO_SECRET_KEY')
    secret_key = os.environ.get('SECRET_KEY')
    settings_secret = getattr(settings, 'SECRET_KEY', None)
    jwt_signing_key = getattr(settings, 'SIMPLE_JWT', {}).get('SIGNING_KEY')
    
    print(f"DJANGO_SECRET_KEY env var: {'SET' if django_secret else 'NOT SET'}")
    print(f"SECRET_KEY env var: {'SET' if secret_key else 'NOT SET'}")
    print(f"Django settings.SECRET_KEY: {'SET' if settings_secret else 'NOT SET'}")
    print(f"JWT SIGNING_KEY: {'SET' if jwt_signing_key else 'NOT SET'}")
    
    if django_secret and secret_key:
        print(f"Keys match: {django_secret == secret_key}")
    
    if settings_secret and jwt_signing_key:
        print(f"Settings SECRET_KEY == JWT SIGNING_KEY: {settings_secret == jwt_signing_key}")
    
    # 2. JWT Configuration Analysis
    print_subsection("JWT Configuration")
    jwt_config = getattr(settings, 'SIMPLE_JWT', {})
    
    important_settings = [
        'ACCESS_TOKEN_LIFETIME',
        'REFRESH_TOKEN_LIFETIME', 
        'ALGORITHM',
        'SIGNING_KEY',
        'AUTH_HEADER_TYPES',
        'USER_ID_FIELD',
        'USER_ID_CLAIM',
        'LEEWAY'
    ]
    
    for setting in important_settings:
        value = jwt_config.get(setting, 'NOT SET')
        if setting == 'SIGNING_KEY' and value:
            # Don't print the actual key, just show if it's set and length
            print(f"{setting}: SET (length: {len(str(value))})")
        else:
            print(f"{setting}: {value}")
    
    # 3. Test User Creation and Token Generation
    print_subsection("Test Token Generation")
    
    try:
        # Find or create a test user
        test_username = 'admin'
        custom_user = User.objects.filter(username=test_username).first()
        
        if not custom_user:
            print(f"Custom user '{test_username}' not found")
            return
        
        print(f"Found custom user: {custom_user.username} (ID: {custom_user.id})")
        
        # Get or create Django user
        django_user, created = DjangoUser.objects.get_or_create(
            username=test_username,
            defaults={'email': custom_user.email}
        )
        
        print(f"Django user: {django_user.username} (ID: {django_user.id}) - {'Created' if created else 'Existing'}")
        
        # Generate tokens
        refresh = RefreshToken.for_user(django_user)
        refresh['custom_user_id'] = custom_user.id
        refresh['role'] = custom_user.role
        
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        print(f"Generated access token (length: {len(access_token)})")
        print(f"Generated refresh token (length: {len(refresh_token)})")
        
        # 4. Token Validation Test
        print_subsection("Token Validation Test")
        
        try:
            # Test 1: Validate using django-rest-framework-simplejwt
            validated_token = AccessToken(access_token)
            print("✅ Token validation with AccessToken: SUCCESS")
            print(f"   Token payload: {dict(validated_token.payload)}")
            
        except InvalidToken as e:
            print(f"❌ Token validation with AccessToken: FAILED - {e}")
        except Exception as e:
            print(f"❌ Token validation with AccessToken: ERROR - {e}")
        
        try:
            # Test 2: Validate using PyJWT directly
            decoded = jwt.decode(
                access_token,
                jwt_signing_key or settings_secret,
                algorithms=['HS256'],
                options={"verify_signature": True}
            )
            print("✅ Token validation with PyJWT: SUCCESS")
            print(f"   Decoded payload: {decoded}")
            
        except jwt.InvalidSignatureError as e:
            print(f"❌ Token validation with PyJWT: INVALID SIGNATURE - {e}")
        except jwt.ExpiredSignatureError as e:
            print(f"❌ Token validation with PyJWT: EXPIRED - {e}")
        except Exception as e:
            print(f"❌ Token validation with PyJWT: ERROR - {e}")
        
        # 5. Cross-validation test
        print_subsection("Cross-Validation Test")
        
        # Generate token with different keys to test signature mismatch
        test_keys = [
            django_secret,
            secret_key,
            settings_secret,
            jwt_signing_key
        ]
        
        for i, key in enumerate(test_keys):
            if not key:
                continue
                
            try:
                # Create a simple test token
                test_payload = {
                    'user_id': django_user.id,
                    'exp': datetime.utcnow() + timedelta(hours=1),
                    'iat': datetime.utcnow(),
                    'token_type': 'access'
                }
                
                test_token = jwt.encode(test_payload, key, algorithm='HS256')
                
                # Try to decode with the current JWT signing key
                decoded = jwt.decode(
                    test_token,
                    jwt_signing_key or settings_secret,
                    algorithms=['HS256']
                )
                
                print(f"✅ Key {i+1} validation: SUCCESS")
                
            except jwt.InvalidSignatureError:
                print(f"❌ Key {i+1} validation: SIGNATURE MISMATCH")
            except Exception as e:
                print(f"❌ Key {i+1} validation: ERROR - {e}")
        
        # 6. Database User Mapping Test
        print_subsection("User Mapping Test")
        
        try:
            # Test the user mapping that happens in the middleware
            django_users = DjangoUser.objects.filter(username=test_username)
            custom_users = User.objects.filter(username=test_username)
            
            print(f"Django users with username '{test_username}': {django_users.count()}")
            print(f"Custom users with username '{test_username}': {custom_users.count()}")
            
            if django_users.exists() and custom_users.exists():
                django_user = django_users.first()
                custom_user = custom_users.first()
                print(f"Django user ID: {django_user.id}")
                print(f"Custom user ID: {custom_user.id}")
                print(f"Username match: {django_user.username == custom_user.username}")
                print(f"Email match: {django_user.email == custom_user.email}")
            
        except Exception as e:
            print(f"❌ User mapping test: ERROR - {e}")
        
        # 7. Password Verification Test
        print_subsection("Password Verification Test")
        
        try:
            test_password = 'admin'  # Default admin password
            
            # Test bcrypt verification
            is_valid = bcrypt.checkpw(
                test_password.encode('utf-8'),
                custom_user.password.encode('utf-8')
            )
            
            print(f"Password verification for '{test_username}': {'✅ SUCCESS' if is_valid else '❌ FAILED'}")
            
        except Exception as e:
            print(f"❌ Password verification test: ERROR - {e}")
        
    except Exception as e:
        print(f"❌ Test setup failed: {e}")
        import traceback
        traceback.print_exc()
    
    # 8. Recommendations
    print_subsection("Recommendations")
    
    issues_found = []
    
    if not django_secret:
        issues_found.append("DJANGO_SECRET_KEY environment variable not set")
    
    if django_secret and secret_key and django_secret != secret_key:
        issues_found.append("DJANGO_SECRET_KEY and SECRET_KEY don't match")
    
    if not jwt_signing_key:
        issues_found.append("JWT SIGNING_KEY not configured")
    
    if settings_secret and jwt_signing_key and settings_secret != jwt_signing_key:
        issues_found.append("Django SECRET_KEY and JWT SIGNING_KEY don't match")
    
    if issues_found:
        print("🚨 ISSUES FOUND:")
        for issue in issues_found:
            print(f"   - {issue}")
        
        print("\n💡 RECOMMENDED FIXES:")
        print("   1. Ensure DJANGO_SECRET_KEY is set in Render environment")
        print("   2. Make sure all secret keys use the same value")
        print("   3. Restart all services after environment changes")
        print("   4. Clear browser localStorage and try logging in again")
    else:
        print("✅ No obvious configuration issues found")
        print("💡 If the issue persists, check:")
        print("   1. Browser console for detailed error messages")
        print("   2. Server logs for JWT validation errors")
        print("   3. Network tab for request/response details")

if __name__ == '__main__':
    main()