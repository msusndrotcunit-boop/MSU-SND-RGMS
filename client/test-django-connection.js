#!/usr/bin/env node

/**
 * Django Backend Connection Test Script
 * 
 * This script tests the connection to the Django backend and verifies:
 * 1. Backend is reachable
 * 2. Health endpoint responds
 * 3. CORS headers are present
 * 4. Authentication endpoint is available
 * 
 * Usage:
 *   node test-django-connection.js [backend-url]
 * 
 * Example:
 *   node test-django-connection.js http://localhost:8000
 *   node test-django-connection.js https://rotc-django-web.onrender.com
 */

const https = require('https');
const http = require('http');

// Get backend URL from command line or use default
const backendUrl = process.argv[2] || 'http://localhost:8000';
const isHttps = backendUrl.startsWith('https');
const httpModule = isHttps ? https : http;

console.log('='.repeat(60));
console.log('Django Backend Connection Test');
console.log('='.repeat(60));
console.log(`Testing backend: ${backendUrl}\n`);

// Test results
const results = {
  healthCheck: false,
  corsHeaders: false,
  authEndpoint: false,
  errors: []
};

/**
 * Make HTTP request
 */
function makeRequest(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, backendUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Origin': 'http://localhost:5173', // Vite dev server origin
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Test 1: Health Check Endpoint
 */
async function testHealthCheck() {
  console.log('Test 1: Health Check Endpoint');
  console.log('-'.repeat(60));
  
  try {
    const response = await makeRequest('/api/health');
    
    if (response.statusCode === 200) {
      console.log('✅ Health check endpoint is accessible');
      console.log(`   Status: ${response.statusCode}`);
      
      try {
        const data = JSON.parse(response.body);
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      } catch (e) {
        console.log(`   Response: ${response.body.substring(0, 100)}...`);
      }
      
      results.healthCheck = true;
    } else {
      console.log(`❌ Health check failed with status: ${response.statusCode}`);
      results.errors.push(`Health check returned ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    results.errors.push(`Health check error: ${error.message}`);
  }
  
  console.log('');
}

/**
 * Test 2: CORS Headers
 */
async function testCorsHeaders() {
  console.log('Test 2: CORS Headers');
  console.log('-'.repeat(60));
  
  try {
    const response = await makeRequest('/api/health', 'OPTIONS', {
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type'
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
      'access-control-allow-headers': response.headers['access-control-allow-headers'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials']
    };
    
    if (corsHeaders['access-control-allow-origin']) {
      console.log('✅ CORS headers are present');
      console.log(`   Allow-Origin: ${corsHeaders['access-control-allow-origin']}`);
      console.log(`   Allow-Methods: ${corsHeaders['access-control-allow-methods'] || 'Not set'}`);
      console.log(`   Allow-Headers: ${corsHeaders['access-control-allow-headers'] || 'Not set'}`);
      console.log(`   Allow-Credentials: ${corsHeaders['access-control-allow-credentials'] || 'Not set'}`);
      results.corsHeaders = true;
    } else {
      console.log('⚠️  CORS headers not found (may need configuration)');
      console.log('   This could cause issues with cross-origin requests');
      results.errors.push('CORS headers not configured');
    }
  } catch (error) {
    console.log(`⚠️  CORS test failed: ${error.message}`);
    console.log('   CORS may not be configured yet');
  }
  
  console.log('');
}

/**
 * Test 3: Authentication Endpoint
 */
async function testAuthEndpoint() {
  console.log('Test 3: Authentication Endpoint');
  console.log('-'.repeat(60));
  
  try {
    // Try to access login endpoint (should return 405 for GET, but endpoint exists)
    const response = await makeRequest('/api/auth/login');
    
    // 405 Method Not Allowed means endpoint exists but GET is not allowed (expected)
    // 200 means endpoint exists and responds
    // 404 means endpoint doesn't exist (problem)
    if (response.statusCode === 405 || response.statusCode === 200) {
      console.log('✅ Authentication endpoint is available');
      console.log(`   Status: ${response.statusCode} (${response.statusCode === 405 ? 'POST required' : 'OK'})`);
      results.authEndpoint = true;
    } else if (response.statusCode === 404) {
      console.log('❌ Authentication endpoint not found (404)');
      results.errors.push('Auth endpoint not found');
    } else {
      console.log(`⚠️  Authentication endpoint returned: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Authentication test failed: ${error.message}`);
    results.errors.push(`Auth endpoint error: ${error.message}`);
  }
  
  console.log('');
}

/**
 * Print Summary
 */
function printSummary() {
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  
  const totalTests = 3;
  const passedTests = [
    results.healthCheck,
    results.corsHeaders,
    results.authEndpoint
  ].filter(Boolean).length;
  
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  console.log('');
  
  if (results.healthCheck) {
    console.log('✅ Backend is reachable and healthy');
  } else {
    console.log('❌ Backend health check failed');
  }
  
  if (results.corsHeaders) {
    console.log('✅ CORS is configured');
  } else {
    console.log('⚠️  CORS may need configuration');
  }
  
  if (results.authEndpoint) {
    console.log('✅ Authentication endpoint is available');
  } else {
    console.log('❌ Authentication endpoint not found');
  }
  
  console.log('');
  
  if (results.errors.length > 0) {
    console.log('Errors:');
    results.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
    console.log('');
  }
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The Django backend is ready.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Update .env.production with this backend URL');
    console.log('  2. Test authentication with real credentials');
    console.log('  3. Build and deploy the React frontend');
  } else {
    console.log('⚠️  Some tests failed. Please check the Django backend configuration.');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Ensure Django backend is running');
    console.log('  2. Check CORS_ALLOWED_ORIGINS in Django settings');
    console.log('  3. Verify all migrations have been applied');
    console.log('  4. Check Django logs for errors');
  }
  
  console.log('='.repeat(60));
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testHealthCheck();
    await testCorsHeaders();
    await testAuthEndpoint();
    printSummary();
    
    // Exit with appropriate code
    const allPassed = results.healthCheck && results.authEndpoint;
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
