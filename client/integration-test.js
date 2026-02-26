#!/usr/bin/env node

/**
 * Frontend Integration Test Script
 * 
 * Automated tests for Django backend integration with React frontend
 * 
 * Usage:
 *   node integration-test.js [backend-url]
 * 
 * Example:
 *   node integration-test.js http://localhost:8000
 *   node integration-test.js https://rotc-django-web.onrender.com
 */

const axios = require('axios');

// Configuration
const API_URL = process.argv[2] || 'http://localhost:8000';
const TEST_TIMEOUT = 10000; // 10 seconds

// Test credentials (update these with your test accounts)
const TEST_CREDENTIALS = {
  admin: { 
    username: process.env.TEST_ADMIN_USER || 'admin', 
    password: process.env.TEST_ADMIN_PASS || 'admin123' 
  },
  cadet: { 
    username: process.env.TEST_CADET_USER || 'cadet1', 
    password: process.env.TEST_CADET_PASS || 'cadet123' 
  },
  staff: { 
    username: process.env.TEST_STAFF_USER || 'staff1', 
    password: process.env.TEST_STAFF_PASS || 'staff123' 
  }
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Tokens storage
let tokens = {};

/**
 * Run a single test
 */
async function runTest(name, testFn, category = 'General') {
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, category, status: 'PASS' });
    console.log(`  ✅ ${name}`);
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ 
      name, 
      category, 
      status: 'FAIL', 
      error: error.message 
    });
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    return false;
  }
}

/**
 * Skip a test
 */
function skipTest(name, reason, category = 'General') {
  testResults.skipped++;
  testResults.tests.push({ name, category, status: 'SKIP', reason });
  console.log(`  ⊘ ${name} (${reason})`);
}

/**
 * Test: Health Check
 */
async function testHealthCheck() {
  const response = await axios.get(`${API_URL}/api/health`, { timeout: TEST_TIMEOUT });
  if (response.status !== 200) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
}

/**
 * Test: Login
 */
async function testLogin(role) {
  const response = await axios.post(
    `${API_URL}/api/auth/login`, 
    TEST_CREDENTIALS[role],
    { timeout: TEST_TIMEOUT }
  );
  
  if (!response.data.token) {
    throw new Error('No token in response');
  }
  
  if (!response.data.user) {
    throw new Error('No user data in response');
  }
  
  if (response.data.user.role !== role) {
    throw new Error(`Expected role ${role}, got ${response.data.user.role}`);
  }
  
  // Store token for later tests
  tokens[role] = response.data.token;
  
  return response.data.token;
}

/**
 * Test: Get Profile
 */
async function testGetProfile(role) {
  const token = tokens[role];
  if (!token) throw new Error('No token available');
  
  const response = await axios.get(`${API_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.user) {
    throw new Error('No user data in response');
  }
}

/**
 * Test: Get Cadet List
 */
async function testGetCadetList() {
  const token = tokens.admin;
  if (!token) throw new Error('No admin token available');
  
  const response = await axios.get(`${API_URL}/api/cadets`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.data) {
    throw new Error('No data array in response');
  }
  
  if (!Array.isArray(response.data.data)) {
    throw new Error('Data is not an array');
  }
}

/**
 * Test: Get Grades List
 */
async function testGetGradesList() {
  const token = tokens.admin;
  if (!token) throw new Error('No admin token available');
  
  const response = await axios.get(`${API_URL}/api/grades`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.data) {
    throw new Error('No data array in response');
  }
}

/**
 * Test: Get Training Days
 */
async function testGetTrainingDays() {
  const token = tokens.admin;
  if (!token) throw new Error('No admin token available');
  
  const response = await axios.get(`${API_URL}/api/training-days`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.data) {
    throw new Error('No data array in response');
  }
}

/**
 * Test: Get Activities
 */
async function testGetActivities() {
  const token = tokens.admin;
  if (!token) throw new Error('No admin token available');
  
  const response = await axios.get(`${API_URL}/api/activities`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.data) {
    throw new Error('No data array in response');
  }
}

/**
 * Test: Get Notifications
 */
async function testGetNotifications(role) {
  const token = tokens[role];
  if (!token) throw new Error(`No ${role} token available`);
  
  const response = await axios.get(`${API_URL}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.data) {
    throw new Error('No data array in response');
  }
}

/**
 * Test: Get Admin Messages
 */
async function testGetAdminMessages(role) {
  const token = tokens[role];
  if (!token) throw new Error(`No ${role} token available`);
  
  const response = await axios.get(`${API_URL}/api/messages/admin`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: TEST_TIMEOUT
  });
  
  if (!response.data.data) {
    throw new Error('No data array in response');
  }
}

/**
 * Test: Unauthorized Access
 */
async function testUnauthorizedAccess() {
  try {
    await axios.get(`${API_URL}/api/cadets`, { timeout: TEST_TIMEOUT });
    throw new Error('Request should have been rejected');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Expected behavior
      return;
    }
    throw error;
  }
}

/**
 * Test: Invalid Credentials
 */
async function testInvalidCredentials() {
  try {
    await axios.post(`${API_URL}/api/auth/login`, {
      username: 'invalid_user',
      password: 'invalid_pass'
    }, { timeout: TEST_TIMEOUT });
    throw new Error('Login should have failed');
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 400)) {
      // Expected behavior
      return;
    }
    throw error;
  }
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  const total = testResults.passed + testResults.failed + testResults.skipped;
  const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`Total Tests:   ${total}`);
  console.log(`Passed:        ${testResults.passed} ✅`);
  console.log(`Failed:        ${testResults.failed} ❌`);
  console.log(`Skipped:       ${testResults.skipped} ⊘`);
  console.log(`Pass Rate:     ${passRate}%`);
  console.log('');
  
  // Group by category
  const categories = {};
  testResults.tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = { passed: 0, failed: 0, skipped: 0 };
    }
    if (test.status === 'PASS') categories[test.category].passed++;
    else if (test.status === 'FAIL') categories[test.category].failed++;
    else if (test.status === 'SKIP') categories[test.category].skipped++;
  });
  
  console.log('Results by Category:');
  Object.keys(categories).forEach(category => {
    const stats = categories[category];
    const total = stats.passed + stats.failed + stats.skipped;
    const rate = total > 0 ? ((stats.passed / total) * 100).toFixed(0) : 0;
    console.log(`  ${category}: ${stats.passed}/${total} (${rate}%)`);
  });
  
  console.log('');
  
  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAIL')
      .forEach(test => {
        console.log(`  ❌ ${test.name}`);
        console.log(`     ${test.error}`);
      });
    console.log('');
  }
  
  console.log('='.repeat(70));
  
  if (testResults.failed === 0) {
    console.log('🎉 All tests passed! The Django backend integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
  
  console.log('='.repeat(70));
}

/**
 * Main test execution
 */
async function main() {
  console.log('='.repeat(70));
  console.log('FRONTEND INTEGRATION TESTS');
  console.log('='.repeat(70));
  console.log(`API URL: ${API_URL}`);
  console.log(`Timeout: ${TEST_TIMEOUT}ms`);
  console.log('='.repeat(70));
  console.log('');
  
  // Test 1: Health Check
  console.log('1. Health Check');
  await runTest('Backend Health Check', testHealthCheck, 'Health');
  console.log('');
  
  // Test 2: Authentication
  console.log('2. Authentication Tests');
  const adminLoginSuccess = await runTest('Admin Login', () => testLogin('admin'), 'Authentication');
  await runTest('Cadet Login', () => testLogin('cadet'), 'Authentication');
  await runTest('Staff Login', () => testLogin('staff'), 'Authentication');
  await runTest('Invalid Credentials', testInvalidCredentials, 'Authentication');
  await runTest('Unauthorized Access', testUnauthorizedAccess, 'Authentication');
  console.log('');
  
  if (!adminLoginSuccess) {
    console.log('⚠️  Admin login failed. Skipping tests that require authentication.');
    console.log('');
    printSummary();
    process.exit(1);
  }
  
  // Test 3: User Profile
  console.log('3. User Profile Tests');
  await runTest('Get Admin Profile', () => testGetProfile('admin'), 'Profile');
  await runTest('Get Cadet Profile', () => testGetProfile('cadet'), 'Profile');
  await runTest('Get Staff Profile', () => testGetProfile('staff'), 'Profile');
  console.log('');
  
  // Test 4: Cadet Management
  console.log('4. Cadet Management Tests');
  await runTest('Get Cadet List', testGetCadetList, 'Cadets');
  console.log('');
  
  // Test 5: Grade Management
  console.log('5. Grade Management Tests');
  await runTest('Get Grades List', testGetGradesList, 'Grades');
  console.log('');
  
  // Test 6: Attendance
  console.log('6. Attendance Tests');
  await runTest('Get Training Days', testGetTrainingDays, 'Attendance');
  console.log('');
  
  // Test 7: Activities
  console.log('7. Activities Tests');
  await runTest('Get Activities', testGetActivities, 'Activities');
  console.log('');
  
  // Test 8: Messaging & Notifications
  console.log('8. Messaging & Notifications Tests');
  await runTest('Get Admin Notifications', () => testGetNotifications('admin'), 'Messaging');
  await runTest('Get Admin Messages', () => testGetAdminMessages('admin'), 'Messaging');
  console.log('');
  
  // Print summary
  printSummary();
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
