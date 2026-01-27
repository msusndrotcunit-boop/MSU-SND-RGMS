const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

// Multer config for file upload (Memory storage for immediate parsing)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Training Days ---

// Get all training days
router.get('/days', authenticateToken, (req, res) => {
    db.all('SELECT * FROM training_days ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Create a training day
router.post('/days', authenticateToken, isAdmin, (req, res) => {
    const { date, title, description } = req.body;
    db.run('INSERT INTO training_days (date, title, description) VALUES (?, ?, ?)', 
        [date, title, description], 
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ id: this.lastID, message: 'Training day created' });
        }
    );
});

// Delete a training day
router.delete('/days/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM training_days WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Training day deleted' });
    });
});

// --- Attendance Records ---

// Get attendance for a specific day (includes all cadets, even if not marked)
router.get('/records/:dayId', authenticateToken, isAdmin, (req, res) => {
    const dayId = req.params.dayId;
    const { company, platoon } = req.query;

    let sql = `
        SELECT 
            c.id as cadet_id, 
            c.last_name, 
            c.first_name, 
            c.rank,
            c.company,
            c.platoon,
            ar.status, 
            ar.remarks
        FROM cadets c
        LEFT JOIN attendance_records ar ON c.id = ar.cadet_id AND ar.training_day_id = ?
        WHERE 1=1
    `;
    const params = [dayId];

    if (company) {
        sql += ' AND c.company = ?';
        params.push(company);
    }
    if (platoon) {
        sql += ' AND c.platoon = ?';
        params.push(platoon);
    }

    sql += ' ORDER BY c.last_name ASC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Get attendance records for a specific cadet
router.get('/cadet/:cadetId', authenticateToken, isAdmin, (req, res) => {
    const cadetId = req.params.cadetId;
    const sql = `
        SELECT 
            ar.id,
            ar.status,
            ar.remarks,
            td.date,
            td.title,
            td.description
        FROM attendance_records ar
        JOIN training_days td ON ar.training_day_id = td.id
        WHERE ar.cadet_id = ?
        ORDER BY td.date DESC
    `;
    
    db.all(sql, [cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark attendance (Upsert)
router.post('/mark', authenticateToken, isAdmin, (req, res) => {
    const { dayId, cadetId, status, remarks } = req.body;

    // Check if record exists
    db.get('SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?', [dayId, cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
            // Update
            db.run('UPDATE attendance_records SET status = ?, remarks = ? WHERE id = ?', 
                [status, remarks, row.id], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    updateTotalAttendance(cadetId, res);
                }
            );
        } else {
            // Insert
            db.run('INSERT INTO attendance_records (training_day_id, cadet_id, status, remarks) VALUES (?, ?, ?, ?)', 
                [dayId, cadetId, status, remarks], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    updateTotalAttendance(cadetId, res);
                }
            );
        }
    });
});

// Helper to update total attendance count in grades table
function updateTotalAttendance(cadetId, res) {
    // Count 'present' and 'excused' records
    db.get(`SELECT COUNT(*) as count FROM attendance_records WHERE cadet_id = ? AND status IN ('present', 'excused')`, [cadetId], (err, row) => {
        if (err) {
            console.error(`Error counting attendance for cadet ${cadetId}:`, err);
            return;
        }
        
        const count = row.count;
        
        // Update grades table
        db.run('UPDATE grades SET attendance_present = ? WHERE cadet_id = ?', [count, cadetId], function(err) {
            if (err) console.error(`Error updating grades for cadet ${cadetId}:`, err);
            
            if (this.changes === 0) {
                // Grade record might not exist, create it
                db.run('INSERT INTO grades (cadet_id, attendance_present) VALUES (?, ?)', [cadetId, count], (err) => {
                    if (err) console.error(`Error creating grade record for cadet ${cadetId}:`, err);
                });
            }
        });
    });
}

// --- Import Helpers ---

// Parse PDF buffer to text rows
const parsePdf = async (buffer) => {
    try {
        const data = await pdfParse(buffer);
        // Split by new lines and try to structure
        // Simple strategy: Return lines as objects with 'raw' text
        // The matcher will try to extract info from 'raw'
        return data.text.split('\n').map(line => ({ raw: line.trim() })).filter(l => l.raw);
    } catch (err) {
        console.error("PDF Parse Error:", err);
        return [];
    }
};

// Parse DOCX buffer to text rows
const parseDocx = async (buffer) => {
    try {
        const result = await mammoth.extractRawText({ buffer: buffer });
        return result.value.split('\n').map(line => ({ raw: line.trim() })).filter(l => l.raw);
    } catch (err) {
        console.error("DOCX Parse Error:", err);
        return [];
    }
};

// Extract data from raw text line
const extractFromRaw = (line) => {
    const row = {};
    // Regex for Student ID (Simple assumption: contains digits, maybe dashes)
    // Adjust regex based on actual ID format. e.g., "2021-00123" or "123456"
    const idMatch = line.match(/(\d{4}-\d{4,6}|\d{6,10})/); 
    if (idMatch) row['Student ID'] = idMatch[0];

    // Regex for Email
    const emailMatch = line.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
    if (emailMatch) row['Email'] = emailMatch[0];

    // Status keywords
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('present')) row['Status'] = 'present';
    else if (lowerLine.includes('absent')) row['Status'] = 'absent';
    else if (lowerLine.includes('late')) row['Status'] = 'late';
    else if (lowerLine.includes('excused')) row['Status'] = 'excused';

    // Name extraction is very hard from raw string without delimiter. 
    // We will skip name extraction from raw lines unless it's comma separated clearly.
    // However, if we found ID or Email, we might not need Name.
    
    return row;
};

// Import Attendance from File (CSV/Excel/PDF/DOCX)
router.post('/import', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { dayId } = req.body;
    if (!dayId) {
        return res.status(400).json({ message: 'Day ID is required' });
    }

    try {
        let data = [];
        const mime = req.file.mimetype;
        const filename = req.file.originalname.toLowerCase();

        if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = xlsx.utils.sheet_to_json(sheet);
        } else if (filename.endsWith('.pdf')) {
            const rawRows = await parsePdf(req.file.buffer);
            data = rawRows.map(r => extractFromRaw(r.raw));
        } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
            const rawRows = await parseDocx(req.file.buffer);
            data = rawRows.map(r => extractFromRaw(r.raw));
        } else {
            return res.status(400).json({ message: 'Unsupported file format' });
        }

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // DB Helpers (Promisified)
        const getCadetByStudentId = (studentId) => {
            return new Promise((resolve, reject) => {
                db.get('SELECT id FROM cadets WHERE student_id = ?', [studentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };

        const getCadetByEmail = (email) => {
            return new Promise((resolve, reject) => {
                db.get('SELECT id FROM cadets WHERE email = ?', [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };

        const getCadetByName = (firstName, lastName) => {
            return new Promise((resolve, reject) => {
                // Case insensitive search
                db.get('SELECT id FROM cadets WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?)', 
                    [firstName, lastName], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };

        const findCadet = async (row) => {
            // 1. Try Student ID
            const studentId = row['Student ID'] || row['ID'] || row['Student Number'] || row['student_id'];
            if (studentId) {
                try {
                    const cadet = await getCadetByStudentId(studentId);
                    if (cadet) return cadet;
                } catch (e) {}
            }

            // 2. Try Email
            const email = row['Email'] || row['email'] || row['EMAIL'];
            if (email) {
                try {
                    const cadet = await getCadetByEmail(email);
                    if (cadet) return cadet;
                } catch (e) {}
            }

            // 3. Try Name
            let lastName = row['Last Name'] || row['last_name'] || row['Surname'];
            let firstName = row['First Name'] || row['first_name'];
            const fullName = row['Name'] || row['name'] || row['Student Name'] || row['Student'];

            if (!lastName && !firstName && fullName) {
                // Heuristic: "Last, First" or "First Last"
                if (fullName.includes(',')) {
                    const parts = fullName.split(',');
                    lastName = parts[0].trim();
                    firstName = parts[1].trim();
                } else {
                    const parts = fullName.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        lastName = parts[parts.length - 1]; 
                        firstName = parts.slice(0, -1).join(' ');
                    }
                }
            }

            if (lastName && firstName) {
                try {
                    const cadet = await getCadetByName(firstName, lastName);
                    if (cadet) return cadet;
                } catch (e) {}
            }

            return null;
        };

        // Helper for async attendance upsert
        const upsertAttendance = (cadetId, status, remarks) => {
            return new Promise((resolve, reject) => {
                db.get('SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?', [dayId, cadetId], (err, row) => {
                    if (err) return reject(err);

                    if (row) {
                        db.run('UPDATE attendance_records SET status = ?, remarks = ? WHERE id = ?', 
                            [status, remarks, row.id], 
                            (err) => {
                                if (err) reject(err);
                                else {
                                    updateTotalAttendance(cadetId, null); 
                                    resolve('updated');
                                }
                            }
                        );
                    } else {
                        db.run('INSERT INTO attendance_records (training_day_id, cadet_id, status, remarks) VALUES (?, ?, ?, ?)', 
                            [dayId, cadetId, status, remarks], 
                            (err) => {
                                if (err) reject(err);
                                else {
                                    updateTotalAttendance(cadetId, null); 
                                    resolve('inserted');
                                }
                            }
                        );
                    }
                });
            });
        };

        for (const row of data) {
            // Flexible column matching
            const status = (row['Status'] || row['status'] || 'present').toLowerCase();
            const remarks = row['Remarks'] || row['remarks'] || '';

            try {
                const cadet = await findCadet(row);
                
                if (cadet) {
                    await upsertAttendance(cadet.id, status, remarks);
                    successCount++;
                } else {
                    // Only count as failure if there was some identifiable info
                    const id = row['Student ID'] || row['ID'];
                    const email = row['Email'];
                    const name = row['Name'] || (row['First Name'] + ' ' + row['Last Name']);
                    
                    if (id || email || name) {
                        failCount++;
                        errors.push(`Cadet not found: ${id || email || name}`);
                    }
                }
            } catch (err) {
                console.error(err);
                failCount++;
                errors.push(`Error processing row: ${err.message}`);
            }
        }

        res.json({ 
            message: `Import complete. Success: ${successCount}, Failed: ${failCount}`,
            errors: errors.slice(0, 10) 
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Failed to process file' });
    }
});

// --- Cadet View ---

// Get my attendance history
router.get('/my-history', authenticateToken, (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet' });

    const sql = `
        SELECT 
            td.date,
            td.title,
            ar.status,
            ar.remarks
        FROM training_days td
        LEFT JOIN attendance_records ar ON td.id = ar.training_day_id AND ar.cadet_id = ?
        ORDER BY td.date DESC
    `;

    db.all(sql, [cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

module.exports = router;
