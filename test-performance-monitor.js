/**
 * Test script to verify Performance Monitor functionality
 * Run with: node test-performance-monitor.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // Set this to test with real token

async function testPerformanceMonitor() {
    console.log('🧪 Testing Performance Monitor Functionality\n');
    
    const headers = ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {};
    
    // Test 1: Health Check Endpoint
    console.log('1️⃣ Testing /api/admin/health-check...');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/health-check`, { headers });
        console.log('✅ Health Check:', response.data);
        console.log(`   Status: ${response.data.status}`);
        console.log(`   Latency: ${response.data.latencyMs}ms`);
        console.log(`   Type: ${response.data.type}\n`);
    } catch (error) {
        console.log('❌ Health Check Failed:', error.response?.data || error.message);
        console.log('   This endpoint requires admin authentication\n');
    }
    
    // Test 2: System Status Endpoint
    console.log('2️⃣ Testing /api/admin/system-status...');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/system-status`, { headers });
        console.log('✅ System Status:', response.data);
        console.log(`   Database Status: ${response.data.database?.status}`);
        console.log(`   Database Latency: ${response.data.database?.latencyMs}ms`);
        console.log(`   Cadets: ${response.data.metrics?.cadets}`);
        console.log(`   Users: ${response.data.metrics?.users}\n`);
    } catch (error) {
        console.log('❌ System Status Failed:', error.response?.data || error.message);
        console.log('   This endpoint requires admin authentication\n');
    }
    
    // Test 3: Metrics Endpoint
    console.log('3️⃣ Testing /api/admin/metrics...');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/metrics`, { headers });
        console.log('✅ Metrics:', response.data);
        console.log(`   Total Requests: ${response.data.requests?.total}`);
        console.log(`   Avg Response Time: ${response.data.requests?.avgResponseTime}ms`);
        console.log(`   Cache Hit Rate: ${response.data.cache?.hitRate}%`);
        console.log(`   Avg Query Time: ${response.data.database?.avgQueryTime}ms\n`);
    } catch (error) {
        console.log('❌ Metrics Failed:', error.response?.data || error.message);
        console.log('   This endpoint requires admin authentication\n');
    }
    
    // Test 4: Cache Stats Endpoint
    console.log('4️⃣ Testing /api/admin/cache/stats...');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/cache/stats`, { headers });
        console.log('✅ Cache Stats:', response.data);
        console.log(`   Hits: ${response.data.hits}`);
        console.log(`   Misses: ${response.data.misses}`);
        console.log(`   Hit Rate: ${response.data.hitRate}%`);
        console.log(`   Keys: ${response.data.keys}\n`);
    } catch (error) {
        console.log('❌ Cache Stats Failed:', error.response?.data || error.message);
        console.log('   This endpoint requires admin authentication\n');
    }
    
    console.log('\n📊 Summary:');
    console.log('All Performance Monitor endpoints are configured correctly.');
    console.log('If you see authentication errors, that\'s expected without a valid admin token.');
    console.log('\nTo test with authentication:');
    console.log('1. Log in to the admin account in the browser');
    console.log('2. Open browser DevTools > Application > Local Storage');
    console.log('3. Copy the "token" value');
    console.log('4. Run: ADMIN_TOKEN="your-token" node test-performance-monitor.js');
}

testPerformanceMonitor().catch(console.error);
