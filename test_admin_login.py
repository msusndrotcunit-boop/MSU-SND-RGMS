"""
Test script to diagnose and verify admin login functionality.
"""
import requests
import json

BASE_URL = "https://msu-snd-rgms-1.onrender.com"

print("=" * 60)
print("ADMIN LOGIN DIAGNOSTIC TEST")
print("=" * 60)

# Test 1: Check JWT Configuration
print("\n1. Checking JWT Configuration...")
try:
    response = requests.get(f"{BASE_URL}/api/jwt-diagnostic")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ JWT Diagnostic: {data.get('status')}")
        print(f"  Keys Match: {data.get('keys_match')}")
        if not data.get('keys_match'):
            print("  ⚠ WARNING: Secret keys do not match!")
    else:
        print(f"✗ JWT Diagnostic failed: {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 2: Create/Verify Admin Account
print("\n2. Creating/Verifying Admin Account...")
try:
    response = requests.get(f"{BASE_URL}/api/emergency-admin")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Admin Account: {data.get('message')}")
        print(f"  Username: {data.get('username')}")
        print(f"  User ID: {data.get('user_id')}")
        print(f"  Password Verification: {data.get('password_verification')}")
        username = data.get('username')
        password = data.get('password')
    else:
        print(f"✗ Admin creation failed: {response.status_code}")
        exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Test 3: Test Login
print("\n3. Testing Login...")
try:
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Login Successful")
        print(f"  Token Length: {len(data.get('token', ''))} characters")
        print(f"  Role: {data.get('role')}")
        access_token = data.get('token')
        refresh_token = data.get('refresh')
    else:
        print(f"✗ Login failed: {response.status_code}")
        print(f"  Response: {response.text}")
        exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Test 4: Validate Token
print("\n4. Testing Token Validation...")
try:
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/api/auth/profile", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Token Validation Successful")
        print(f"  User: {data.get('username')}")
        print(f"  Role: {data.get('role')}")
    else:
        print(f"✗ Token validation failed: {response.status_code}")
        print(f"  Response: {response.text}")
        
        # Try to get more details
        try:
            error_data = response.json()
            print(f"  Error Code: {error_data.get('error')}")
            print(f"  Message: {error_data.get('message')}")
            print(f"  Request ID: {error_data.get('request_id')}")
        except:
            pass
        exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Test 5: Test Token Refresh
print("\n5. Testing Token Refresh...")
try:
    response = requests.post(
        f"{BASE_URL}/api/auth/refresh",
        json={"refresh": refresh_token}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Token Refresh Successful")
        print(f"  New Token Length: {len(data.get('token', ''))} characters")
    else:
        print(f"✗ Token refresh failed: {response.status_code}")
        print(f"  Response: {response.text}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 6: Deep Authentication Trace
print("\n6. Running Deep Authentication Trace...")
try:
    response = requests.post(
        f"{BASE_URL}/api/deep-auth-trace/",
        json={"username": username, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Deep Trace: {data.get('overall_status')}")
        
        trace = data.get('trace', {})
        
        # Check critical steps
        if trace.get('step7_secret_keys', {}).get('keys_match'):
            print(f"  ✓ Secret keys match")
        else:
            print(f"  ✗ Secret keys DO NOT match")
        
        if trace.get('step9_immediate_validation', {}).get('valid'):
            print(f"  ✓ Token validation works")
        else:
            print(f"  ✗ Token validation failed")
            print(f"    Error: {trace.get('step9_immediate_validation', {}).get('error')}")
        
        if trace.get('step10_jwt_authentication', {}).get('success'):
            print(f"  ✓ JWT authentication works")
        else:
            print(f"  ✗ JWT authentication failed")
    else:
        print(f"✗ Deep trace failed: {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
print("\nIf all tests passed, admin login should work.")
print("If any tests failed, check the error messages above.")
