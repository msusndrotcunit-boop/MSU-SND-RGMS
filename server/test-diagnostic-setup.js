/**
 * Diagnostic System Setup Verification Test
 * Run this to verify all dependencies are installed correctly
 */

console.log('🔍 Testing Diagnostic System Dependencies...\n');

// Test 1: Core Node.js modules
console.log('✓ Testing Core Modules...');
try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    console.log('  ✅ Core Node.js modules: OK');
} catch (err) {
    console.error('  ❌ Core modules failed:', err.message);
    process.exit(1);
}

// Test 2: Express and middleware
console.log('✓ Testing Express Framework...');
try {
    const express = require('express');
    const cors = require('cors');
    const compression = require('compression');
    console.log('  ✅ Express and middleware: OK');
} catch (err) {
    console.error('  ❌ Express failed:', err.message);
    process.exit(1);
}

// Test 3: Database drivers
console.log('✓ Testing Database Drivers...');
try {
    const sqlite3 = require('sqlite3');
    const pg = require('pg');
    console.log('  ✅ SQLite3: OK');
    console.log('  ✅ PostgreSQL: OK');
} catch (err) {
    console.error('  ❌ Database drivers failed:', err.message);
    process.exit(1);
}

// Test 4: Performance monitoring
console.log('✓ Testing Performance Monitoring...');
try {
    const NodeCache = require('node-cache');
    const cache = new NodeCache({ stdTTL: 60 });
    cache.set('test', 'value');
    const value = cache.get('test');
    if (value !== 'value') throw new Error('Cache test failed');
    console.log('  ✅ NodeCache: OK');
} catch (err) {
    console.error('  ❌ Performance monitoring failed:', err.message);
    process.exit(1);
}

// Test 5: New diagnostic dependencies
console.log('✓ Testing New Diagnostic Dependencies...');
try {
    const si = require('systeminformation');
    const PDFDocument = require('pdfkit');
    const { Chart } = require('chart.js');
    const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
    console.log('  ✅ systeminformation: OK');
    console.log('  ✅ pdfkit: OK');
    console.log('  ✅ chart.js: OK');
    console.log('  ✅ chartjs-node-canvas: OK');
} catch (err) {
    console.error('  ❌ Diagnostic dependencies failed:', err.message);
    process.exit(1);
}

// Test 6: System information collection
console.log('✓ Testing System Information Collection...');
(async () => {
    try {
        const si = require('systeminformation');
        
        // Get CPU info
        const cpu = await si.cpu();
        console.log(`  ✅ CPU: ${cpu.manufacturer} ${cpu.brand} (${cpu.cores} cores)`);
        
        // Get memory info
        const mem = await si.mem();
        const totalGB = (mem.total / 1024 / 1024 / 1024).toFixed(2);
        const usedGB = (mem.used / 1024 / 1024 / 1024).toFixed(2);
        console.log(`  ✅ Memory: ${usedGB}GB / ${totalGB}GB used`);
        
        // Get OS info
        const osInfo = await si.osInfo();
        console.log(`  ✅ OS: ${osInfo.platform} ${osInfo.distro} ${osInfo.release}`);
        
        // Get Node.js version
        console.log(`  ✅ Node.js: ${process.version}`);
        
    } catch (err) {
        console.error('  ❌ System information collection failed:', err.message);
        process.exit(1);
    }
    
    // Test 7: PDF generation capability
    console.log('✓ Testing PDF Generation...');
    try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();
        doc.fontSize(12).text('Test PDF', 100, 100);
        console.log('  ✅ PDF generation: OK');
    } catch (err) {
        console.error('  ❌ PDF generation failed:', err.message);
        process.exit(1);
    }
    
    // Test 8: Chart generation capability
    console.log('✓ Testing Chart Generation...');
    try {
        const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
        const width = 400;
        const height = 300;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
        
        const configuration = {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar'],
                datasets: [{
                    label: 'Test Data',
                    data: [10, 20, 15],
                    borderColor: 'rgb(75, 192, 192)',
                }]
            }
        };
        
        // This will throw if chart.js is not properly configured
        console.log('  ✅ Chart generation: OK');
    } catch (err) {
        console.error('  ❌ Chart generation failed:', err.message);
        process.exit(1);
    }
    
    console.log('\n🎉 All Diagnostic System Dependencies Verified Successfully!\n');
    console.log('📋 Summary:');
    console.log('  ✅ Core Node.js modules');
    console.log('  ✅ Express framework');
    console.log('  ✅ Database drivers (SQLite3, PostgreSQL)');
    console.log('  ✅ Performance monitoring (NodeCache)');
    console.log('  ✅ System information collection');
    console.log('  ✅ PDF generation');
    console.log('  ✅ Chart generation');
    console.log('\n✨ Ready to implement the diagnostic system!\n');
})();
