#!/usr/bin/env python3
"""
Comprehensive Role-Based Access Control Test Script
Tests Admin, Cadet, and Training Staff access to their respective routes.
"""

import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Configuration
BASE_URL = "https://msu-snd-rgms-1.onrender.com"
API_BASE = f"{BASE_URL}/api/v1"

# Test user credentials (you'll need to update these with actual test accounts)
TEST_USERS = {
    'admin': {
        'username': 'admin',
        'password': 'admin123',  # Update with actual admin password
        'expected_role': 'admin'
    },
    'cadet': {
        'username': 'test_cadet',
        'password': 'cadet123',  # Update with actual cadet password
        'expected_role': 'cadet'
    },
    'training_staff': {
        'username': 'test_staff',
        'password': 'staff123',  # Update with actual staff password
        'expected_role': 'training_staff'
    }
}

# Role-based endpoint mappings
ROLE_ENDPOINTS = {
    'admin': [
        # Admin-specific endpoints
        '/api/v1/cadets/',
        '/api/v1/staff/',
        '/api/v1/activities/',
        '/api/v1/attendance/',
        '/api/v1/grades/',
        '/api/v1/reports/',
        '/api/v1/admin/dashboard',
        '/api/v1/admin/analytics',
        '/api/v1/admin/users',
        '/api/v1/system/health',
        '/api/v1/system/status',
        '/api/v1/files/upload',
        '/api/v1/messaging/admin',
    ],
    'cadet': [
        # Cadet-specific endpoints
        '/api/v1/cadet/profile',
        '/api/v1/cadet/dashboard',
        '/api/v1/cadet/grades',
        '/api/v1/cadet/attendance',
        '/api/v1/cadet/activities',
        '/api/v1/cadet/achievements',
        '/api/v1/cadet/notifications',
        '/api/v1/messaging/cadet',
    ],
    'training_staff': [
        # Training Staff-specific endpoints
        '/api/v1/staff/profile',
        '/api/v1/staff/dashboard',
        '/api/v1/staff/cadets',
        '/api/v1/staff/attendance',
        '/api/v1/staff/activities',
        '/api/v1/staff/grading',
        '/api/v1/staff/notifications',
        '/api/v1/messaging/staff',
    ]
}

# Common endpoints (accessible by all authenticated users)
COMMON_ENDPOINTS = [
    '/api/v1/auth/profile',
    '/api/v1/auth/settings',
    '/api/health/',
]

class RoleAccessTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = 30
        self.tokens = {}
        self.test_results = []
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def test_health_check(self) -> bool:
        """Test if the service is running"""
        self.log("Testing service health check...")
        try:
            response = self.session.get(f"{BASE_URL}/api/health/")
            if response.status_code == 200:
                health_data = response.json()
                self.log(f"✅ Service is healthy: {health_data.get('status', 'unknown')}")
                return True
            else:
                self.log(f"❌ Health check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check error: {str(e)}", "ERROR")
            return False
    
    def login_user(self, role: str) -> Optional[str]:
        """Login user and return JWT token"""
        if role not in TEST_USERS:
            self.log(f"❌ Unknown role: {role}", "ERROR")
            return None
            
        user_creds = TEST_USERS[role]
        self.log(f"Logging in as {role}: {user_creds['username']}")
        
        try:
            login_data = {
                'username': user_creds['username'],
                'password': user_creds['password']
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('token')
                user_role = data.get('role')
                user_data = data.get('user', {})
                
                if user_role != user_creds['expected_role']:
                    self.log(f"❌ Role mismatch for {role}: expected {user_creds['expected_role']}, got {user_role}", "ERROR")
                    return None
                
                self.log(f"✅ Login successful for {role}: {user_data.get('username', 'unknown')}")
                self.tokens[role] = token
                return token
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else f"HTTP {response.status_code}"
                self.log(f"❌ Login failed for {role}: {error_msg}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Login error for {role}: {str(e)}", "ERROR")
            return None
    
    def test_endpoint_access(self, role: str, endpoint: str, token: str) -> Dict:
        """Test access to a specific endpoint"""
        headers = {'Authorization': f'Bearer {token}'}
        
        try:
            response = self.session.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            result = {
                'role': role,
                'endpoint': endpoint,
                'status_code': response.status_code,
                'success': False,
                'message': '',
                'response_time': response.elapsed.total_seconds()
            }
            
            if response.status_code == 200:
                result['success'] = True
                result['message'] = 'Access granted'
                self.log(f"✅ {role} can access {endpoint} ({response.status_code})")
            elif response.status_code == 401:
                result['message'] = 'Unauthorized - Invalid token'
                self.log(f"❌ {role} unauthorized for {endpoint} (401)")
            elif response.status_code == 403:
                result['message'] = 'Forbidden - Insufficient permissions'
                self.log(f"❌ {role} forbidden from {endpoint} (403)")
            elif response.status_code == 404:
                result['message'] = 'Endpoint not found'
                self.log(f"⚠️  {role} - endpoint not found {endpoint} (404)")
            else:
                result['message'] = f'HTTP {response.status_code}'
                self.log(f"⚠️  {role} - unexpected response for {endpoint} ({response.status_code})")
            
            return result
            
        except Exception as e:
            result = {
                'role': role,
                'endpoint': endpoint,
                'status_code': 0,
                'success': False,
                'message': f'Request error: {str(e)}',
                'response_time': 0
            }
            self.log(f"❌ {role} - request error for {endpoint}: {str(e)}", "ERROR")
            return result
    
    def test_role_endpoints(self, role: str) -> List[Dict]:
        """Test all endpoints for a specific role"""
        token = self.tokens.get(role)
        if not token:
            self.log(f"❌ No token available for {role}", "ERROR")
            return []
        
        self.log(f"\n🔍 Testing {role.upper()} role endpoints...")
        results = []
        
        # Test role-specific endpoints
        role_endpoints = ROLE_ENDPOINTS.get(role, [])
        for endpoint in role_endpoints:
            result = self.test_endpoint_access(role, endpoint, token)
            results.append(result)
            time.sleep(0.1)  # Rate limiting
        
        # Test common endpoints
        self.log(f"\n🔍 Testing common endpoints for {role.upper()}...")
        for endpoint in COMMON_ENDPOINTS:
            result = self.test_endpoint_access(role, endpoint, token)
            results.append(result)
            time.sleep(0.1)  # Rate limiting
        
        return results
    
    def test_cross_role_access(self) -> List[Dict]:
        """Test that roles cannot access other roles' endpoints"""
        self.log(f"\n🔒 Testing cross-role access restrictions...")
        results = []
        
        for role, token in self.tokens.items():
            if not token:
                continue
                
            # Test access to other roles' endpoints
            for other_role, endpoints in ROLE_ENDPOINTS.items():
                if other_role == role:
                    continue  # Skip own role
                
                self.log(f"Testing {role} access to {other_role} endpoints...")
                for endpoint in endpoints[:3]:  # Test first 3 endpoints to save time
                    result = self.test_endpoint_access(role, endpoint, token)
                    result['cross_role_test'] = True
                    result['target_role'] = other_role
                    results.append(result)
                    time.sleep(0.1)
        
        return results
    
    def test_websocket_connection(self, role: str) -> Dict:
        """Test WebSocket connection for role"""
        token = self.tokens.get(role)
        if not token:
            return {'role': role, 'success': False, 'message': 'No token available'}
        
        self.log(f"Testing WebSocket connection for {role}...")
        
        try:
            import websocket
            
            ws_url = f"wss://msu-snd-rgms-1.onrender.com/ws/notifications/?token={token}"
            
            def on_open(ws):
                self.log(f"✅ WebSocket connected for {role}")
                ws.close()
            
            def on_error(ws, error):
                self.log(f"❌ WebSocket error for {role}: {error}")
            
            ws = websocket.WebSocketApp(ws_url, on_open=on_open, on_error=on_error)
            ws.run_forever(timeout=5)
            
            return {'role': role, 'success': True, 'message': 'WebSocket connection successful'}
            
        except ImportError:
            return {'role': role, 'success': False, 'message': 'websocket-client not installed'}
        except Exception as e:
            return {'role': role, 'success': False, 'message': f'WebSocket error: {str(e)}'}
    
    def generate_report(self, all_results: List[Dict]) -> str:
        """Generate test report"""
        report = []
        report.append("=" * 80)
        report.append("ROLE-BASED ACCESS CONTROL TEST REPORT")
        report.append("=" * 80)
        report.append(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Base URL: {BASE_URL}")
        report.append("")
        
        # Summary by role
        for role in ['admin', 'cadet', 'training_staff']:
            role_results = [r for r in all_results if r['role'] == role and not r.get('cross_role_test', False)]
            if not role_results:
                continue
                
            successful = len([r for r in role_results if r['success']])
            total = len(role_results)
            success_rate = (successful / total * 100) if total > 0 else 0
            
            report.append(f"{role.upper()} ROLE SUMMARY:")
            report.append(f"  ✅ Successful: {successful}/{total} ({success_rate:.1f}%)")
            
            # Failed endpoints
            failed = [r for r in role_results if not r['success']]
            if failed:
                report.append(f"  ❌ Failed endpoints:")
                for result in failed:
                    report.append(f"    - {result['endpoint']}: {result['message']}")
            
            report.append("")
        
        # Cross-role access test results
        cross_role_results = [r for r in all_results if r.get('cross_role_test', False)]
        if cross_role_results:
            report.append("CROSS-ROLE ACCESS RESTRICTIONS:")
            
            # Should be blocked (403 or 401)
            properly_blocked = [r for r in cross_role_results if r['status_code'] in [401, 403]]
            improperly_allowed = [r for r in cross_role_results if r['status_code'] == 200]
            
            report.append(f"  ✅ Properly blocked: {len(properly_blocked)}")
            report.append(f"  ❌ Improperly allowed: {len(improperly_allowed)}")
            
            if improperly_allowed:
                report.append("  🚨 SECURITY ISSUES:")
                for result in improperly_allowed:
                    report.append(f"    - {result['role']} can access {result['target_role']} endpoint: {result['endpoint']}")
            
            report.append("")
        
        # Performance summary
        response_times = [r['response_time'] for r in all_results if r['response_time'] > 0]
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            max_time = max(response_times)
            report.append(f"PERFORMANCE SUMMARY:")
            report.append(f"  Average response time: {avg_time:.3f}s")
            report.append(f"  Maximum response time: {max_time:.3f}s")
            report.append("")
        
        # Overall status
        total_tests = len([r for r in all_results if not r.get('cross_role_test', False)])
        successful_tests = len([r for r in all_results if r['success'] and not r.get('cross_role_test', False)])
        overall_success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
        
        report.append("OVERALL TEST RESULTS:")
        report.append(f"  Total tests: {total_tests}")
        report.append(f"  Successful: {successful_tests}")
        report.append(f"  Success rate: {overall_success_rate:.1f}%")
        
        if len(improperly_allowed) > 0:
            report.append(f"  🚨 SECURITY ISSUES FOUND: {len(improperly_allowed)}")
        else:
            report.append("  ✅ No security issues found")
        
        report.append("=" * 80)
        
        return "\n".join(report)
    
    def run_all_tests(self) -> bool:
        """Run comprehensive role-based access tests"""
        self.log("🚀 Starting Role-Based Access Control Tests")
        self.log("=" * 60)
        
        # Test service health
        if not self.test_health_check():
            self.log("❌ Service health check failed. Aborting tests.", "ERROR")
            return False
        
        # Login all test users
        self.log("\n🔐 Logging in test users...")
        for role in ['admin', 'cadet', 'training_staff']:
            token = self.login_user(role)
            if not token:
                self.log(f"❌ Failed to login {role}. Some tests will be skipped.", "ERROR")
        
        if not self.tokens:
            self.log("❌ No users logged in successfully. Aborting tests.", "ERROR")
            return False
        
        # Test role-specific endpoints
        all_results = []
        for role in self.tokens.keys():
            results = self.test_role_endpoints(role)
            all_results.extend(results)
        
        # Test cross-role access restrictions
        cross_role_results = self.test_cross_role_access()
        all_results.extend(cross_role_results)
        
        # Test WebSocket connections
        self.log(f"\n🔌 Testing WebSocket connections...")
        for role in self.tokens.keys():
            ws_result = self.test_websocket_connection(role)
            self.log(f"WebSocket {role}: {ws_result['message']}")
        
        # Generate and display report
        report = self.generate_report(all_results)
        print("\n" + report)
        
        # Save report to file
        with open(f"role_access_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt", 'w') as f:
            f.write(report)
        
        # Determine overall success
        security_issues = len([r for r in cross_role_results if r['status_code'] == 200])
        failed_tests = len([r for r in all_results if not r['success'] and not r.get('cross_role_test', False)])
        
        if security_issues > 0:
            self.log(f"🚨 CRITICAL: {security_issues} security issues found!", "ERROR")
            return False
        elif failed_tests > 0:
            self.log(f"⚠️  {failed_tests} tests failed, but no security issues found.", "WARNING")
            return True
        else:
            self.log("✅ All tests passed successfully!", "SUCCESS")
            return True

def main():
    """Main function"""
    print("MSU-SND ROTC Grading Management System")
    print("Role-Based Access Control Test Suite")
    print("=" * 60)
    
    # Check if test credentials are configured
    print("\n📋 Test Configuration:")
    for role, creds in TEST_USERS.items():
        print(f"  {role.upper()}: {creds['username']} (Update password in script)")
    
    print(f"\n🎯 Target URL: {BASE_URL}")
    
    # Confirm before running
    response = input("\nProceed with tests? (y/N): ").strip().lower()
    if response != 'y':
        print("Tests cancelled.")
        return
    
    # Run tests
    tester = RoleAccessTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()