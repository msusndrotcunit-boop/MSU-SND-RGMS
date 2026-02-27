"""
Test token validation.
"""
import requests
import json

BASE_URL = "https://msu-snd-rgms-1.onrender.com"

# Get admin credentials
admin_response = requests.get(f"{BASE_URL}/api/emergency-admin")
admin_json = admin_response.json()
admin_data = admin_json.get('data', admin_json)  # Handle both wrapped and unwrapped
username = admin_data['username']
password = admin_data['password']

# Login
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": username, "password": password}
)
login_json = login_response.json()
login_data = login_json.get('data', login_json)  # Handle both wrapped and unwrapped
token = login_data['token']

print("=" * 60)
print("TOKEN VALIDATION TEST")
print("=" * 60)
print(f"\nToken (first 50 chars): {token[:50]}...")
print(f"Token length: {len(token)} characters")

# Test token validation
print("\nTesting token with /api/auth/profile...")
headers = {"Authorization": f"Bearer {token}"}
profile_response = requests.get(f"{BASE_URL}/api/auth/profile", headers=headers)

print(f"Status Code: {profile_response.status_code}")

if profile_response.status_code == 200:
    print("✓ TOKEN VALIDATION SUCCESSFUL!")
    profile_data = profile_response.json()
    if 'data' in profile_data:
        user_data = profile_data['data']
    else:
        user_data = profile_data
    print(f"  User: {user_data.get('username')}")
    print(f"  Role: {user_data.get('role')}")
else:
    print("✗ TOKEN VALIDATION FAILED!")
    print(f"\nResponse:")
    print(json.dumps(profile_response.json(), indent=2))

print("\n" + "=" * 60)
