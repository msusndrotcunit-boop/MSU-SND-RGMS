const db = require('./server/database');

const run = async () => {
    console.log('Syncing attendance for all cadets...');
    
    db.all('SELECT id, first_name, last_name FROM cadets', [], (err, cadets) => {
        if (err) {
            console.error('Error fetching cadets:', err);
            return;
        }
        
        console.log(`Found ${cadets.length} cadets.`);
        
        if (cadets.length === 0) return;

        let completed = 0;
        
        cadets.forEach(cadet => {
            db.get(`SELECT COUNT(*) as count FROM attendance_records WHERE cadet_id = ? AND status IN ('present', 'excused')`, [cadet.id], (err, row) => {
                if (err) {
                    console.error(`Error counting for cadet ${cadet.id}:`, err);
                    completed++;
                    return;
                } 

                const count = row ? row.count : 0;
                
                // Update grades table
                db.run('UPDATE grades SET attendance_present = ? WHERE cadet_id = ?', [count, cadet.id], function(err) {
                    if (err) console.error(`Error updating grades for cadet ${cadet.id}:`, err);
                    
                    if (this.changes === 0) {
                        // Grade record might not exist, create it
                        db.run('INSERT INTO grades (cadet_id, attendance_present) VALUES (?, ?)', [cadet.id, count], (err) => {
                            if (err) console.error(`Error creating grade record for cadet ${cadet.id}:`, err);
                        });
                    }
                });
                
                completed++;
                if (completed === cadets.length) {
                    console.log('Sync complete.');
                }
            });
        });
    });
};

// Wait for DB connection
setTimeout(run, 1000);
