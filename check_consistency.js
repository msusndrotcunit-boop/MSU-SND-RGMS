const db = require('./server/database');

async function checkConsistency() {
    console.log("Checking Attendance Consistency...");
    
    db.all(`
        SELECT 
            c.id, 
            c.first_name, 
            c.last_name, 
            g.attendance_present as grade_count,
            (SELECT COUNT(*) FROM attendance_records ar WHERE ar.cadet_id = c.id AND lower(ar.status) IN ('present', 'excused')) as actual_count
        FROM cadets c
        LEFT JOIN grades g ON c.id = g.cadet_id
    `, [], (err, rows) => {
        if (err) {
            console.error("Error running consistency check:", err);
            process.exit(1);
        }
        
        let inconsistencies = 0;
        rows.forEach(row => {
            if (row.grade_count !== row.actual_count) {
                console.log(`Mismatch for ${row.first_name} ${row.last_name} (ID: ${row.id}): Grade Table=${row.grade_count}, Actual Records=${row.actual_count}`);
                inconsistencies++;
            }
        });
        
        if (inconsistencies === 0) {
            console.log("All attendance records are consistent with grades table.");
        } else {
            console.log(`Found ${inconsistencies} inconsistencies.`);
        }
        process.exit(0);
    });
}

checkConsistency();
