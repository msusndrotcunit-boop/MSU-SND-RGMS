"""
Detailed JWT diagnostic test.
"""
import requests
import json

BASE_URL = "https://msu-snd-rgms-1.onrender.com"

print("Testing JWT Diagnostic Endpoint...")
print("=" * 60)

response = requests.get(f"{BASE_URL}/api/jwt-diagnostic")
print(f"Status Code: {response.status_code}")
print(f"\nFull Response:")
print(json.dumps(response.json(), indent=2))

print("\n" + "=" * 60)
print("Testing Login Endpoint...")
print("=" * 60)

# First create admin
admin_response = requests.get(f"{BASE_URL}/api/emergency-admin")
admin_data = admin_response.json()
username = admin_data.get('username')
password = admin_data.get('password')

print(f"Admin Username: {username}")
print(f"Admin Password: {password}")

# Try login
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": username, "password": password}
)

print(f"\nLogin Status Code: {login_response.status_code}")
print(f"\nFull Login Response:")
print(json.dumps(login_response.json(), indent=2))
