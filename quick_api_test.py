#!/usr/bin/env python3
"""
Quick API Test Script for MSU-SND ROTC System
Tests basic functionality and role-based access
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://msu-snd-rgms-1.onrender.com"

def test_health():
    """Test service health"""
    print("🏥 Testing service health...")
    try:
        response = requests.get(f"{BASE_URL}/api/health/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Service is healthy: {data.get('status')}")
            print(f"   Database: {data.get('services', {}).get('database', 'unknown')}")
            print(f"   Redis: {data.get('services', {}).get('redis', 'unknown')}")
            print(f"   Celery: {data.get('services', {}).get('celery', 'unknown')}")
            return True
        else:
            print(f"❌ Health check failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_login(username, password, expected_role):
    """Test user login"""
    print(f"\n🔐 Testing login for {username}...")
    try:
        login_data = {
            'username': username,
            'password': password
        }
        
        response = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            role = data.get('role')
            user = data.get('user', {})
            
            print(f"✅ Login successful")
            print(f"   Username: {user.get('username')}")
            print(f"   Role: {role}")
            print(f"   Token: {token[:20]}..." if token else "   Token: None")
            
            if role == expected_role:
                print(f"✅ Role matches expected: {expected_role}")
                return token
            else:
                print(f"❌ Role mismatch: expected {expected_role}, got {role}")
                return None
        else:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get('error', f'HTTP {response.status_code}')
            print(f"❌ Login failed: {error_msg}")
            return None
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_api_endpoint(endpoint, token, should_work=True):
    """Test API endpoint access"""
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        
        if should_work:
            if response.status_code == 200:
                print(f"✅ {endpoint} - Access granted (200)")
                return True
            else:
                print(f"❌ {endpoint} - Access denied ({response.status_code})")
                return False
        else:
            if response.status_code in [401, 403]:
                print(f"✅ {endpoint} - Properly blocked ({response.status_code})")
                return True
            elif response.status_code == 200:
                print(f"🚨 {endpoint} - SECURITY ISSUE: Should be blocked but got 200!")
                return False
            else:
                print(f"⚠️  {endpoint} - Unexpected response ({response.status_code})")
                return True  # Not a security issue, just unexpected
                
    except Exception as e:
        print(f"❌ {endpoint} - Request error: {e}")
        return False

def main():
    """Main test function"""
    print("MSU-SND ROTC System - Quick API Test")
    print("=" * 50)
    
    # Test service health
    if not test_health():
        print("\n❌ Service is not healthy. Please check deployment.")
        return False
    
    # Get test credentials
    print("\n📝 Enter test credentials:")
    
    # Admin test
    admin_username = input("Admin username (default: admin): ").strip() or "admin"
    admin_password = input("Admin password: ").strip()
    
    if not admin_password:
        print("❌ Admin password required")
        return False
    
    # Test admin login
    admin_token = test_login(admin_username, admin_password, 'admin')
    
    if admin_token:
        print(f"\n🔍 Testing admin API access...")
        test_api_endpoint('/api/v1/auth/profile', admin_token, should_work=True)
        test_api_endpoint('/api/v1/cadets/', admin_token, should_work=True)
        test_api_endpoint('/api/v1/staff/', admin_token, should_work=True)
        test_api_endpoint('/api/v1/activities/', admin_token, should_work=True)
        test_api_endpoint('/api/health/', admin_token, should_work=True)
    
    # Optional: Test other roles if credentials provided
    print(f"\n🤔 Test other roles? (optional)")
    test_others = input("Test cadet/staff accounts? (y/N): ").strip().lower()
    
    if test_others == 'y':
        # Cadet test
        cadet_username = input("\nCadet username: ").strip()
        cadet_password = input("Cadet password: ").strip()
        
        if cadet_username and cadet_password:
            cadet_token = test_login(cadet_username, cadet_password, 'cadet')
            if cadet_token:
                print(f"\n🔍 Testing cadet API access...")
                test_api_endpoint('/api/v1/auth/profile', cadet_token, should_work=True)
                test_api_endpoint('/api/v1/cadet/profile', cadet_token, should_work=True)
                # Test restrictions
                test_api_endpoint('/api/v1/cadets/', cadet_token, should_work=False)
                test_api_endpoint('/api/v1/staff/', cadet_token, should_work=False)
        
        # Staff test
        staff_username = input("\nStaff username: ").strip()
        staff_password = input("Staff password: ").strip()
        
        if staff_username and staff_password:
            staff_token = test_login(staff_username, staff_password, 'training_staff')
            if staff_token:
                print(f"\n🔍 Testing staff API access...")
                test_api_endpoint('/api/v1/auth/profile', staff_token, should_work=True)
                test_api_endpoint('/api/v1/staff/profile', staff_token, should_work=True)
                # Test some restrictions (may vary by staff role)
                test_api_endpoint('/api/v1/system/status', staff_token, should_work=False)
    
    print(f"\n✅ Quick API test completed!")
    print(f"\nFor comprehensive testing, use:")
    print(f"  - MANUAL_ROLE_ACCESS_TEST.md (manual testing guide)")
    print(f"  - test_role_access.py (automated testing script)")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n\n⏹️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)