const db = require('./database');

async function debug() {
    console.log('--- Database Debug ---');
    
    const pAll = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const pGet = (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });

    try {
        // 0. Check Table Counts
        const tables = ['users', 'cadets', 'training_days', 'attendance_records', 'merit_demerit_logs', 'grades'];
        console.log('--- Table Counts ---');
        for (const table of tables) {
            try {
                const count = await pGet(`SELECT count(*) as count FROM ${table}`);
                console.log(`${table}: ${count.count}`);
            } catch (e) {
                console.log(`${table}: Table not found or error: ${e.message}`);
            }
        }

        // 1. Search for specific student_id
        const studentId = '1005231';
        console.log(`\n--- Searching for Student ID: ${studentId} ---`);
        const targetCadet = await pGet('SELECT * FROM cadets WHERE student_id = ?', [studentId]);
        console.log('Cadet record:', JSON.stringify(targetCadet, null, 2));

        if (targetCadet) {
            // Check if there is a user linked to this cadet
            const targetUser = await pGet('SELECT * FROM users WHERE cadet_id = ? OR username = ?', [targetCadet.id, targetCadet.student_id]);
            console.log('User record for this cadet:', JSON.stringify(targetUser, null, 2));
            
            const cadetId = targetCadet.id;
            console.log(`\n--- Data for Cadet ID: ${cadetId} ---`);
            
            const att = await pAll('SELECT * FROM attendance_records WHERE cadet_id = ?', [cadetId]);
            console.log(`Attendance Records (${att.length}):`, JSON.stringify(att, null, 2));
            
            const logs = await pAll('SELECT * FROM merit_demerit_logs WHERE cadet_id = ?', [cadetId]);
            console.log(`Merit/Demerit Logs (${logs.length}):`, JSON.stringify(logs, null, 2));
        } else {
            console.log('\n--- Sample Cadets (First 5) ---');
            const samples = await pAll('SELECT id, first_name, last_name, student_id FROM cadets LIMIT 5');
            console.log(JSON.stringify(samples, null, 2));
        }
        
        // 5. Check training_days
        const days = await pAll('SELECT * FROM training_days LIMIT 3');
        console.log('\nTraining Days:', JSON.stringify(days, null, 2));

    } catch (e) {
        console.error('Debug error:', e);
    }
}

// Wait for database connection (SQLite init is usually fast but let's give it a moment)
setTimeout(debug, 1000);
