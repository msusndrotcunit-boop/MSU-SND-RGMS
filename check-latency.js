/**
 * Check current database latency
 * Run with: node check-latency.js
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://msu-snd-rgms-jcsg.onrender.com';
const TOKEN = process.env.ADMIN_TOKEN || '';

async function checkLatency() {
    console.log('🔍 Checking Database Latency...\n');
    
    if (!TOKEN) {
        console.log('⚠️  No ADMIN_TOKEN provided. Please set it as an environment variable.');
        console.log('   Example: ADMIN_TOKEN="your-token" node check-latency.js\n');
    }
    
    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
    
    try {
        // Test 1: Health Check (Simple SELECT 1)
        console.log('1️⃣ Testing /api/admin/health-check (Simple query)...');
        const start1 = Date.now();
        const health = await axios.get(`${BASE_URL}/api/admin/health-check`, { headers });
        const clientLatency1 = Date.now() - start1;
        console.log(`   ✅ Server reported: ${health.data.latencyMs}ms`);
        console.log(`   📡 Client measured: ${clientLatency1}ms (includes network)`);
        console.log(`   🗄️  Database type: ${health.data.type}\n`);
        
        // Test 2: System Status (With COUNT queries in background)
        console.log('2️⃣ Testing /api/admin/system-status (With background counts)...');
        const start2 = Date.now();
        const status = await axios.get(`${BASE_URL}/api/admin/system-status`, { headers });
        const clientLatency2 = Date.now() - start2;
        console.log(`   ✅ Server reported: ${status.data.database.latencyMs}ms`);
        console.log(`   📡 Client measured: ${clientLatency2}ms (includes network)`);
        console.log(`   📊 Metrics: ${status.data.metrics.cadets} cadets, ${status.data.metrics.users} users\n`);
        
        // Analysis
        console.log('📈 Analysis:');
        console.log(`   • Health check latency: ${health.data.latencyMs}ms (pure connection test)`);
        console.log(`   • System status latency: ${status.data.database.latencyMs}ms (connection + cached counts)`);
        console.log(`   • Network overhead: ~${clientLatency1 - health.data.latencyMs}ms\n`);
        
        if (health.data.latencyMs < 50) {
            console.log('✅ Excellent! Database latency is very low (<50ms)');
        } else if (health.data.latencyMs < 200) {
            console.log('✅ Good! Database latency is acceptable (<200ms)');
        } else if (health.data.latencyMs < 500) {
            console.log('⚠️  Moderate. Database latency is within target but could be better.');
        } else {
            console.log('❌ High! Database latency exceeds target (>500ms)');
            console.log('   Consider running the "Optimize DB" button in Performance Monitor');
        }
        
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('❌ Authentication failed. Please provide a valid ADMIN_TOKEN.');
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

checkLatency();
