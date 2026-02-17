/**
 * Database Diagnostic Script
 * Run this to check database connection and basic health
 * 
 * Usage: node server/scripts/diagnose-db.js
 */

const path = require('path');
const fs = require('fs');

console.log('=== Database Diagnostic Tool ===\n');

// Check if database file exists
const dbPath = path.resolve(__dirname, '..', 'rotc.db');
console.log('1. Checking database file...');
console.log('   Path:', dbPath);

if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('   ✓ File exists');
    console.log('   Size:', (stats.size / 1024).toFixed(2), 'KB');
    console.log('   Modified:', stats.mtime.toISOString());
    
    // Check file permissions
    try {
        fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
        console.log('   ✓ File is readable and writable');
    } catch (err) {
        console.log('   ✗ Permission error:', err.message);
    }
} else {
    console.log('   ✗ Database file does not exist!');
    console.log('   The database needs to be initialized.');
    process.exit(1);
}

// Try to connect to database
console.log('\n2. Testing database connection...');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.log('   ✗ Connection failed:', err.message);
        process.exit(1);
    }
    
    console.log('   ✓ Connected successfully');
    
    // Test basic query
    console.log('\n3. Testing basic query...');
    db.get('SELECT 1 as test', [], (err, row) => {
        if (err) {
            console.log('   ✗ Query failed:', err.message);
            db.close();
            process.exit(1);
        }
        
        console.log('   ✓ Query successful');
        
        // Check tables
        console.log('\n4. Checking database tables...');
        db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
            if (err) {
                console.log('   ✗ Failed to list tables:', err.message);
                db.close();
                process.exit(1);
            }
            
            console.log('   Found', tables.length, 'tables:');
            tables.forEach(t => console.log('   -', t.name));
            
            // Check key tables
            console.log('\n5. Checking key tables...');
            const keyTables = ['users', 'cadets', 'training_days', 'attendance_records'];
            let completed = 0;
            
            keyTables.forEach(tableName => {
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
                    if (err) {
                        console.log(`   ✗ ${tableName}: Error -`, err.message);
                    } else {
                        console.log(`   ✓ ${tableName}: ${row.count} records`);
                    }
                    
                    completed++;
                    if (completed === keyTables.length) {
                        console.log('\n=== Diagnostic Complete ===');
                        console.log('Database appears to be healthy!');
                        db.close();
                    }
                });
            });
        });
    });
});
