"""
JWT Deployment Verification Script
Verifies that JWT authentication is working correctly after deployment.
"""
import requests
import sys
import json
from datetime import datetime


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'


def print_success(message):
    """Print success message in green."""
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")


def print_error(message):
    """Print error message in red."""
    print(f"{Colors.RED}✗ {message}{Colors.END}")


def print_warning(message):
    """Print warning message in yellow."""
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")


def print_info(message):
    """Print info message in blue."""
    print(f"{Colors.BLUE}ℹ {message}{Colors.END}")


def print_header(message):
    """Print header message."""
    print(f"\n{Colors.BOLD}{message}{Colors.END}")
    print("=" * 60)


def verify_jwt_configuration(base_url):
    """Verify JWT configuration."""
    print_header("1. Verifying JWT Configuration")
    
    try:
        response = requests.get(f"{base_url}/api/jwt-diagnostic", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('keys_match'):
                print_success("JWT signing and verification keys match")
            else:
                print_error("JWT signing and verification keys DO NOT match")
                print_warning("This will cause token validation failures!")
                return False
            
            print_info(f"Status: {data.get('status')}")
            return True
        else:
            print_error(f"JWT diagnostic endpoint returned {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Failed to connect to JWT diagnostic endpoint: {e}")
        return False


def test_admin_account_creation(base_url):
    """Test admin account creation."""
    print_header("2. Testing Admin Account Creation")
    
    try:
        response = requests.get(f"{base_url}/api/emergency-admin", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                print_success("Admin account created/verified successfully")
                print_info(f"Username: {data.get('username')}")
                print_info(f"User ID: {data.get('user_id')}")
                print_info(f"Password verification: {data.get('password_verification')}")
                return True, data.get('username'), data.get('password')
            else:
                print_error("Admin account creation failed")
                return False, None, None
        else:
            print_error(f"Emergency admin endpoint returned {response.status_code}")
            return False, None, None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Failed to create admin account: {e}")
        return False, None, None


def test_login(base_url, username, password):
    """Test login and token generation."""
    print_header("3. Testing Login and Token Generation")
    
    try:
        response = requests.post(
            f"{base_url}/api/auth/login",
            json={"username": username, "password": password},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if 'token' in data:
                print_success("Login successful")
                print_success("Access token generated")
                print_info(f"Token length: {len(data['token'])} characters")
                
                if 'refresh' in data:
                    print_success("Refresh token generated")
                
                return True, data.get('token'), data.get('refresh')
            else:
                print_error("Login response missing token")
                return False, None, None
        else:
            print_error(f"Login failed with status {response.status_code}")
            print_error(f"Response: {response.text}")
            return False, None, None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Login request failed: {e}")
        return False, None, None


def test_token_validation(base_url, token):
    """Test token validation by accessing protected endpoint."""
    print_header("4. Testing Token Validation")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{base_url}/api/auth/profile",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print_success("Token validation successful")
            print_success("Protected endpoint accessible")
            
            data = response.json()
            print_info(f"User: {data.get('username')}")
            print_info(f"Role: {data.get('role')}")
            return True
        elif response.status_code == 401:
            print_error("Token validation failed (401 Unauthorized)")
            
            try:
                error_data = response.json()
                print_error(f"Error code: {error_data.get('error')}")
                print_error(f"Message: {error_data.get('message')}")
                print_info(f"Request ID: {error_data.get('request_id')}")
            except:
                print_error(f"Response: {response.text}")
            
            return False
        else:
            print_error(f"Unexpected status code: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Token validation request failed: {e}")
        return False


def test_token_refresh(base_url, refresh_token):
    """Test token refresh."""
    print_header("5. Testing Token Refresh")
    
    if not refresh_token:
        print_warning("No refresh token available, skipping test")
        return True
    
    try:
        response = requests.post(
            f"{base_url}/api/auth/refresh",
            json={"refresh": refresh_token},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if 'token' in data:
                print_success("Token refresh successful")
                print_success("New access token generated")
                return True
            else:
                print_error("Refresh response missing token")
                return False
        else:
            print_error(f"Token refresh failed with status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Token refresh request failed: {e}")
        return False


def test_deep_auth_trace(base_url, username, password):
    """Test deep authentication trace."""
    print_header("6. Testing Deep Authentication Trace")
    
    try:
        response = requests.post(
            f"{base_url}/api/deep-auth-trace/",
            json={"username": username, "password": password},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('overall_status') == 'SUCCESS':
                print_success("All authentication steps passed")
                
                # Check individual steps
                trace = data.get('trace', {})
                
                if trace.get('step2_password_check', {}).get('valid'):
                    print_success("Password verification: PASS")
                
                if trace.get('step7_secret_keys', {}).get('keys_match'):
                    print_success("Secret keys match: PASS")
                
                if trace.get('step9_immediate_validation', {}).get('valid'):
                    print_success("Token validation: PASS")
                
                if trace.get('step10_jwt_authentication', {}).get('success'):
                    print_success("JWT authentication: PASS")
                
                return True
            else:
                print_error("Authentication trace failed")
                print_error(f"Message: {data.get('message')}")
                
                # Print failed steps
                trace = data.get('trace', {})
                for step_name, step_data in trace.items():
                    if isinstance(step_data, dict):
                        if step_data.get('valid') == False or step_data.get('success') == False:
                            print_error(f"{step_name}: FAILED")
                            if 'error' in step_data:
                                print_error(f"  Error: {step_data['error']}")
                
                return False
        else:
            print_error(f"Deep auth trace returned {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Deep auth trace request failed: {e}")
        return False


def main():
    """Main verification function."""
    # Get base URL from command line or use default
    base_url = sys.argv[1] if len(sys.argv) > 1 else "https://msu-snd-rgms-1.onrender.com"
    
    print(f"\n{Colors.BOLD}JWT Deployment Verification{Colors.END}")
    print(f"Target: {base_url}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # Run tests
    results.append(("JWT Configuration", verify_jwt_configuration(base_url)))
    
    success, username, password = test_admin_account_creation(base_url)
    results.append(("Admin Account Creation", success))
    
    if success and username and password:
        success, access_token, refresh_token = test_login(base_url, username, password)
        results.append(("Login and Token Generation", success))
        
        if success and access_token:
            results.append(("Token Validation", test_token_validation(base_url, access_token)))
            results.append(("Token Refresh", test_token_refresh(base_url, refresh_token)))
        
        results.append(("Deep Auth Trace", test_deep_auth_trace(base_url, username, password)))
    
    # Print summary
    print_header("Verification Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        if result:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
    
    print(f"\n{Colors.BOLD}Results: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total:
        print_success("\n✓ All tests passed! JWT authentication is working correctly.")
        return 0
    else:
        print_error(f"\n✗ {total - passed} test(s) failed. Please review the errors above.")
        print_info("\nRefer to JWT_TROUBLESHOOTING_GUIDE.md for solutions.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
