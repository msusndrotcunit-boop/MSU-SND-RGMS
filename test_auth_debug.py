"""
Debug authentication flow.
"""
import requests
import json
import jwt

BASE_URL = "https://msu-snd-rgms-1.onrender.com"

# Get admin and login
admin_response = requests.get(f"{BASE_URL}/api/emergency-admin")
admin_json = admin_response.json()
admin_data = admin_json.get('data', admin_json)

login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": admin_data['username'], "password": admin_data['password']}
)
login_json = login_response.json()
login_data = login_json.get('data', login_json)
token = login_data['token']

print("=" * 60)
print("AUTHENTICATION DEBUG")
print("=" * 60)

# Decode token to see what's inside
print("\n1. Token Payload:")
try:
    # Decode without verification to see contents
    decoded = jwt.decode(token, options={"verify_signature": False})
    print(json.dumps(decoded, indent=2))
except Exception as e:
    print(f"Error decoding: {e}")

# Test with diagnostic login
print("\n2. Testing Diagnostic Login:")
diag_response = requests.post(
    f"{BASE_URL}/api/diagnostic-login/",
    json={"username": admin_data['username'], "password": admin_data['password']}
)
print(f"Status: {diag_response.status_code}")
if diag_response.status_code == 200:
    diag_data = diag_response.json()
    if 'data' in diag_data:
        diag_data = diag_data['data']
    print(f"Success: {diag_data.get('success')}")
    print(f"Message: {diag_data.get('message')}")
    print(f"Token validation: {diag_data.get('token_validation', {}).get('success')}")
    
    # Print logs
    if 'logs' in diag_data:
        print("\nLogs:")
        for log in diag_data['logs']:
            print(f"  {log}")
else:
    print(f"Response: {diag_response.text}")

# Test profile with detailed error
print("\n3. Testing Profile Endpoint:")
headers = {"Authorization": f"Bearer {token}"}
profile_response = requests.get(f"{BASE_URL}/api/auth/profile", headers=headers)
print(f"Status: {profile_response.status_code}")
print(f"Response: {json.dumps(profile_response.json(), indent=2)}")

print("\n" + "=" * 60)
