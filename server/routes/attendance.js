const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const axios = require('axios');

// Multer config for file upload (Memory storage for immediate parsing)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

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
            MAX(ar.status) as status, 
            MAX(ar.remarks) as remarks
        FROM cadets c
        JOIN users u ON c.id = u.cadet_id
        LEFT JOIN attendance_records ar ON c.id = ar.cadet_id AND ar.training_day_id = ?
        WHERE u.is_approved = 1 AND (c.is_archived IS FALSE OR c.is_archived IS NULL) AND c.is_profile_completed = 1
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

    sql += ' GROUP BY c.id ORDER BY c.last_name ASC';

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
    const { dayId, cadetId, status, remarks, time_in, time_out } = req.body;

    // Check if record exists
    db.get('SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?', [dayId, cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
            // Update
            db.run('UPDATE attendance_records SET status = ?, remarks = ?, time_in = ?, time_out = ? WHERE id = ?', 
                [status, remarks, time_in, time_out, row.id], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    updateTotalAttendance(cadetId, res);

                    // Notify Cadet
                    db.get('SELECT id FROM users WHERE cadet_id = ?', [cadetId], (uErr, uRow) => {
                        if (uRow) {
                            db.get('SELECT title, date FROM training_days WHERE id = ?', [dayId], (dErr, dRow) => {
                                const dayTitle = dRow ? `${dRow.title} (${dRow.date})` : 'Training Day';
                                const message = `Your attendance for ${dayTitle} has been marked as ${status}.`;
                                db.run('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [uRow.id, message, 'attendance']);
                            });
                        }
                    });
                }
            );
        } else {
            // Insert
            db.run('INSERT INTO attendance_records (training_day_id, cadet_id, status, remarks, time_in, time_out) VALUES (?, ?, ?, ?, ?, ?)', 
                [dayId, cadetId, status, remarks, time_in, time_out], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    updateTotalAttendance(cadetId, res);

                    // Notify Cadet
                    db.get('SELECT id FROM users WHERE cadet_id = ?', [cadetId], (uErr, uRow) => {
                        if (uRow) {
                            db.get('SELECT title, date FROM training_days WHERE id = ?', [dayId], (dErr, dRow) => {
                                const dayTitle = dRow ? `${dRow.title} (${dRow.date})` : 'Training Day';
                                const message = `Your attendance for ${dayTitle} has been marked as ${status}.`;
                                db.run('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [uRow.id, message, 'attendance']);
                            });
                        }
                    });
                }
            );
        }
    });
});

// Staff Attendance Scan Endpoint
router.post('/staff/scan', authenticateToken, isAdmin, (req, res) => {
    const { dayId, qrData, status: providedStatus } = req.body;
    
    try {
        let staffData;
        try {
            staffData = JSON.parse(qrData);
        } catch (e) {
            // If not JSON, try to handle or fail
            // Sometimes QR might be just ID? Assuming JSON from StaffProfile.jsx
             return res.status(400).json({ message: 'Invalid QR Code format' });
        }

        const staffId = staffData.id;
        if (!staffId) return res.status(400).json({ message: 'Invalid Staff ID in QR Code' });

        // Verify Staff Exists
        db.get('SELECT id, first_name, last_name, rank, afpsn FROM training_staff WHERE id = ?', [staffId], (err, staff) => {
            if (err) return res.status(500).json({ message: err.message });
            if (!staff) return res.status(404).json({ message: 'Staff not found' });

            // Mark Attendance
            const status = providedStatus || 'present';
            const remarks = 'Scanned via QR';

            db.get('SELECT id FROM staff_attendance_records WHERE training_day_id = ? AND staff_id = ?', [dayId, staffId], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });

                if (row) {
                    // Update
                    db.run('UPDATE staff_attendance_records SET status = ?, remarks = ? WHERE id = ?', 
                        [status, remarks, row.id], 
                        (err) => {
                            if (err) return res.status(500).json({ message: err.message });
                            
                            // Notify Staff
                            db.get('SELECT id FROM users WHERE staff_id = ?', [staffId], (uErr, uRow) => {
                                if (uRow) {
                                    db.get('SELECT title, date FROM training_days WHERE id = ?', [dayId], (dErr, dRow) => {
                                        const dayTitle = dRow ? `${dRow.title} (${dRow.date})` : 'Training Day';
                                        const message = `Your attendance for ${dayTitle} has been recorded as ${status}.`;
                                        db.run('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [uRow.id, message, 'attendance']);
                                    });
                                }
                            });

                            res.json({ 
                                message: 'Staff attendance updated', 
                                status: status,
                                staff: { 
                                    name: `${staff.rank} ${staff.first_name} ${staff.last_name}`,
                                    afpsn: staff.afpsn || 'N/A'
                                } 
                            });
                        }
                    );
                } else {
                    // Insert
                    db.run('INSERT INTO staff_attendance_records (training_day_id, staff_id, status, remarks) VALUES (?, ?, ?, ?)', 
                        [dayId, staffId, status, remarks], 
                        (err) => {
                            if (err) return res.status(500).json({ message: err.message });
                            
                            // Notify Staff
                            db.get('SELECT id FROM users WHERE staff_id = ?', [staffId], (uErr, uRow) => {
                                if (uRow) {
                                    db.get('SELECT title, date FROM training_days WHERE id = ?', [dayId], (dErr, dRow) => {
                                        const dayTitle = dRow ? `${dRow.title} (${dRow.date})` : 'Training Day';
                                        const message = `Your attendance for ${dayTitle} has been recorded as ${status}.`;
                                        db.run('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [uRow.id, message, 'attendance']);
                                    });
                                }
                            });

                            res.json({ 
                                message: 'Staff attendance recorded', 
                                status: status,
                                staff: { 
                                    name: `${staff.rank} ${staff.first_name} ${staff.last_name}`,
                                    afpsn: staff.afpsn || 'N/A'
                                } 
                            });
                        }
                    );
                }
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error processing scan' });
    }
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

// Parse Image buffer to text rows using OCR
const parseImage = async (buffer) => {
    try {
        console.log("Starting OCR processing...");
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
            logger: m => console.log(m)
        });
        console.log("OCR Text Extracted:", text);
        return text.split('\n').map(line => ({ raw: line.trim() })).filter(l => l.raw);
    } catch (err) {
        console.error("Image OCR Error:", err);
        return [];
    }
};

// Extract data from raw text line
const extractFromRaw = (line) => {
    const row = {};
    const rawLine = line.trim();
    if (!rawLine) return row;

    // --- NEW: Structured Parsing for PDF/Text imports matching user requirements ---
    // Format: "Cadet Name  Username  Program/Course  Status"
    // Anchor: Program/Course (Basic/MS1, Basic/MS2, Advance/MS31, etc.)
    const programRegex = /\b(Basic\/MS1|Basic\/MS2|Advance\/MS31|Advance\/MS32|Advance\/MS41|Advance\/MS42)\b/i;
    const match = rawLine.match(programRegex);

    if (match) {
        const programIndex = match.index;
        const programStr = match[0];

        // 1. Extract Status (After Program)
        const postProgram = rawLine.substring(programIndex + programStr.length).trim();
        const lowerPost = postProgram.toLowerCase();
        
        if (lowerPost.includes('present')) row['Status'] = 'present';
        else if (lowerPost.includes('absent')) row['Status'] = 'absent';
        else if (lowerPost.includes('excused')) row['Status'] = 'excused';
        else row['Status'] = 'present'; // Default if status is missing/unclear in the suffix? Or let generic logic handle it?
        // The user said: "If present... present. If absent... absent." implied explicit. 
        // We'll set it here.

        // 2. Extract Name (Before Program, removing Username)
        // "Cadet Name Username" -> We need to strip the last word (Username)
        const preProgram = rawLine.substring(0, programIndex).trim();
        const lastSpaceIndex = preProgram.lastIndexOf(' ');
        
        if (lastSpaceIndex !== -1) {
            // Assume the last token is the Username and everything before is the Name
            row['Name'] = preProgram.substring(0, lastSpaceIndex).trim();
        } else {
            // Fallback: If no space, maybe just Name (no username?) or just Username?
            // If the user guarantees the format, this shouldn't happen for valid rows.
            row['Name'] = preProgram;
        }

        return row;
    }

    // --- Fallback to Generic Heuristic Parsing ---

    // Status keywords
    const lowerLine = rawLine.toLowerCase();
    if (lowerLine.includes('present')) row['Status'] = 'present';
    else if (lowerLine.includes('absent')) row['Status'] = 'absent';
    else if (lowerLine.includes('late')) row['Status'] = 'late';
    else if (lowerLine.includes('excused')) row['Status'] = 'excused';
    else row['Status'] = 'unknown'; // Default status to prevent null

    // Header/Noise Blacklist
    const BLACKLIST = [
        'list', 'page', 'date', 'department', 'university', 'college', 'rotc', 'attendance', 
        'sheet', 'signature', 'remarks', 'status', 'id', 'no.', 'rank', 'name', 'unit', 
        'platoon', 'company', 'battalion', 'msu', 'iit', 'philippines', 'school', 'year',
        'semester', 'subject', 'course', 'instructor', 'prepared', 'approved', 'certified'
    ];

    // Check if line is a header
    if (BLACKLIST.some(keyword => lowerLine.includes(keyword))) {
        // If it contains a blacklist word, we treat it as noise UNLESS it looks like a valid name row (unlikely if it has 'page' or 'date')
        // But be careful: 'Status' is in blacklist but we extracted status above. 
        // We only blacklist if it DOESN'T look like a cadet row. 
        // Actually, headers usually contain "Name", "Rank", "Status".
        // If the line is JUST "Name Status Remarks", it should be ignored.
        
        // Strategy: If the cleaned name matches a blacklist word, ignore it.
    }

    // Name Extraction Strategy:
    // User requested to prioritize Name and Status and ignore others (ID/Email).
    // We strip out status keywords, numbers (IDs/Dates), emails, and special chars to isolate the name.
    let cleanName = rawLine
        .replace(/present|absent|late|excused/gi, '') // Remove status
        .replace(/[0-9]/g, '') // Remove numbers (IDs, dates) - STRICTLY obeying "Others are ignored"
        .replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g, '') // Remove emails
        .replace(/[^\w\s,.-]/g, '') // Remove special chars except , . -
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
    
    // Remove leading numbering/punctuation like "1.", "."
    cleanName = cleanName.replace(/^[.,-\s]+/, ''); 

    // Filter out blacklisted words from the *extracted name*
    // e.g. if cleanName is "Date", ignore it.
    const lowerName = cleanName.toLowerCase();
    if (BLACKLIST.some(w => lowerName === w || lowerName === w + 's')) {
        return {}; // Skip this row
    }
    // Also skip if the name contains header-like phrases
    if (lowerName.includes('list of') || lowerName.includes('page of') || lowerName.includes('generated by')) {
        return {};
    }

    if (cleanName.length > 2) {
        row['Name'] = cleanName;
    }

    return row;
};

// --- Shared Import Logic ---

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
        db.get('SELECT id FROM cadets WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?)', 
            [firstName, lastName], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const findCadet = async (row, allCadets = []) => {
    // 1. Try Name (Fuzzy Match - Priority as per user request)
    // We check this first or fall back to it. Since we stripped IDs in extractFromRaw, this is the main path.
    const nameToMatch = row['Name'];
    
    if (nameToMatch && allCadets.length > 0) {
        let bestMatch = null;
        let minDistance = Infinity;
        // Allow fuzzy match. Threshold depends on name length, but 4-5 is usually safe for full names.
        // For very short names, we might want to be stricter.
        const threshold = 5; 

        for (const cadet of allCadets) {
            // Construct possible name formats from DB
            const fullNameNormal = `${cadet.first_name} ${cadet.last_name}`;
            const fullNameReverse = `${cadet.last_name} ${cadet.first_name}`;
            const fullNameComma = `${cadet.last_name}, ${cadet.first_name}`;
            const fullNameCommaReverse = `${cadet.first_name}, ${cadet.last_name}`; // Less common but possible

            const target = nameToMatch.toLowerCase();
            
            const dist1 = levenshteinDistance(target, fullNameNormal.toLowerCase());
            const dist2 = levenshteinDistance(target, fullNameReverse.toLowerCase());
            const dist3 = levenshteinDistance(target, fullNameComma.toLowerCase());
            const dist4 = levenshteinDistance(target, fullNameCommaReverse.toLowerCase());

            const currentMin = Math.min(dist1, dist2, dist3, dist4);

            if (currentMin < minDistance) {
                minDistance = currentMin;
                bestMatch = cadet;
            }
        }

        if (minDistance <= threshold) {
            // Also optionally check if the best match is "close enough" relatively?
            // e.g. if name is "Junjie", distance 5 is too much.
            // But for "Junjie Bahian", distance 2 is fine.
            if (minDistance < (nameToMatch.length * 0.4)) { // 40% difference allowed max
                 return bestMatch;
            }
        }
    }

    // 2. Try Student ID (Fallback if extractFromRaw was modified to allow it, or manually passed)
    const studentId = row['Student ID'] || row['ID'] || row['Student Number'] || row['student_id'];
    if (studentId) {
        try {
            const cadet = await getCadetByStudentId(studentId);
            if (cadet) return cadet;
        } catch (e) {}
    }

    // 3. Try Email (Fallback)
    const email = row['Email'] || row['email'] || row['EMAIL'];
    if (email) {
        try {
            const cadet = await getCadetByEmail(email);
            if (cadet) return cadet;
        } catch (e) {}
    }

    // 4. Try Exact Name (Fallback)
    let lastName = row['Last Name'] || row['last_name'] || row['Surname'];
    let firstName = row['First Name'] || row['first_name'];
    const fullName = row['Name'] || row['name'] || row['Student Name'] || row['Student'];

    if (!lastName && !firstName && fullName) {
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

const upsertAttendance = (dayId, cadetId, status, remarks) => {
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

const processAttendanceData = async (data, dayId) => {
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Pre-fetch all cadets for fuzzy matching
    let allCadets = [];
    try {
        allCadets = await new Promise((resolve, reject) => {
            db.all('SELECT id, first_name, last_name FROM cadets', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } catch (e) {
        console.error("Error fetching cadets for fuzzy match:", e);
    }

    for (const row of data) {
        let status = (row['Status'] || row['status'] || '').toLowerCase();
        
        // If not found in specific column, search entire row values for keywords
        if (!status) {
            const rowValues = Object.values(row).map(v => String(v).toLowerCase());
            for (const val of rowValues) {
                if (val.includes('present')) { status = 'present'; break; }
                if (val.includes('absent')) { status = 'absent'; break; }
                if (val.includes('late')) { status = 'late'; break; }
                if (val.includes('excused')) { status = 'excused'; break; }
            }
        }

        // Default to 'present' if still not found
        if (!status) status = 'present';

        const remarks = row['Remarks'] || row['remarks'] || '';

        try {
            // Pass allCadets to findCadet
            const cadet = await findCadet(row, allCadets);
            
            if (cadet) {
                await upsertAttendance(dayId, cadet.id, status, remarks);
                successCount++;
            } else {
                // User Request: "The names that are not in the system will not be included."
                // We strictly ignore them. No error reporting for "Unknown" names to avoid cluttering with headers/noise.
                skippedCount++;
                // Optional: Log to console for debug but don't return as error
                // console.log(`Skipped unknown name: ${row['Name']}`);
            }
        } catch (err) {
            console.error(err);
            failCount++;
            errors.push(`Error processing row: ${err.message}`);
        }
    }

    return { successCount, failCount, skippedCount, errors };
};

// Import Attendance from File
router.post('/import', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { dayId } = req.body;
    if (!dayId) return res.status(400).json({ message: 'Day ID is required' });

    try {
        let data = [];
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
        } else if (filename.match(/\.(png|jpg|jpeg|bmp|webp|gif|tiff)$/i)) { // Expanded image format support
            const rawRows = await parseImage(req.file.buffer);
            data = rawRows.map(r => extractFromRaw(r.raw));
        } else {
            return res.status(400).json({ message: 'Unsupported file format. Supported: Excel, PDF, Word, Images (PNG, JPG, WEBP, etc.)' });
        }

        const result = await processAttendanceData(data, dayId);

        res.json({ 
            message: `Import complete. Success: ${result.successCount}, Skipped: ${result.skippedCount || 0}, Failed: ${result.failCount}`,
            errors: result.errors.slice(0, 10) 
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Failed to process file' });
    }
});

// Import Attendance from URL (Lightshot/Image Link)
router.post('/import-url', authenticateToken, isAdmin, async (req, res) => {
    const { url, dayId } = req.body;
    if (!url || !dayId) return res.status(400).json({ message: 'URL and Day ID are required' });

    try {
        let imageUrl = url;
        
        // Handle Lightshot (prnt.sc)
        if (url.includes('prnt.sc')) {
            console.log(`Fetching Lightshot URL: ${url}`);
            const response = await axios.get(url, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } 
            });
            const html = response.data;
            const match = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (match && match[1]) {
                imageUrl = match[1];
                console.log(`Found image URL: ${imageUrl}`);
            } else {
                 // Fallback: try regex for the image tag if og:image missing
                 const imgMatch = html.match(/<img.+?src="([^"]+)".+?id="screenshot-image"/);
                 if (imgMatch && imgMatch[1]) {
                     imageUrl = imgMatch[1];
                 } else {
                     return res.status(400).json({ message: 'Could not extract image from Lightshot link' });
                 }
            }
        }

        // Fetch the image
        console.log(`Fetching image from: ${imageUrl}`);
        const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imgResponse.data);
        
        const rawRows = await parseImage(buffer);
        const data = rawRows.map(r => extractFromRaw(r.raw));

        const result = await processAttendanceData(data, dayId);
        
        res.json({ 
            message: `Import complete. Success: ${result.successCount}, Skipped: ${result.skippedCount || 0}, Failed: ${result.failCount}`,
            errors: result.errors.slice(0, 10) 
        });

    } catch (err) {
        console.error("Import URL Error:", err);
        res.status(500).json({ message: 'Failed to process URL: ' + err.message });
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

// --- Staff Attendance ---

// Get attendance for a specific day (Staff)
router.get('/records/staff/:dayId', authenticateToken, isAdmin, (req, res) => {
    const dayId = req.params.dayId;

    let sql = `
        SELECT 
            s.id as staff_id, 
            s.last_name, 
            s.first_name, 
            s.rank,
            sar.status, 
            sar.remarks
        FROM training_staff s
        LEFT JOIN staff_attendance_records sar ON s.id = sar.staff_id AND sar.training_day_id = ?
        ORDER BY s.last_name ASC
    `;
    
    db.all(sql, [dayId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark Staff Attendance (Upsert)
router.post('/mark/staff', authenticateToken, isAdmin, (req, res) => {
    const { dayId, staffId, status, remarks, time_in, time_out } = req.body;

    db.get('SELECT id FROM staff_attendance_records WHERE training_day_id = ? AND staff_id = ?', [dayId, staffId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
            // Update
            db.run('UPDATE staff_attendance_records SET status = ?, remarks = ?, time_in = ?, time_out = ? WHERE id = ?', 
                [status, remarks, time_in, time_out, row.id], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    res.json({ message: 'Updated' });
                }
            );
        } else {
            // Insert
            db.run('INSERT INTO staff_attendance_records (training_day_id, staff_id, status, remarks, time_in, time_out) VALUES (?, ?, ?, ?, ?, ?)', 
                [dayId, staffId, status, remarks, time_in, time_out], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    res.json({ message: 'Marked' });
                }
            );
        }
    });
});

// Get Staff My History
router.get('/my-history/staff', authenticateToken, (req, res) => {
    const staffId = req.user.staffId;
    if (!staffId) return res.status(403).json({ message: 'Not a staff member' });

    const sql = `
        SELECT 
            td.date,
            td.title,
            sar.status,
            sar.remarks
        FROM training_days td
        LEFT JOIN staff_attendance_records sar ON td.id = sar.training_day_id AND sar.staff_id = ?
        ORDER BY td.date DESC
    `;

    db.all(sql, [staffId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Scan Staff QR Code
router.post('/staff/scan', authenticateToken, isAdmin, (req, res) => {
    const { dayId, qrData } = req.body;

    if (!dayId || !qrData) {
        return res.status(400).json({ message: 'Day ID and QR Data are required' });
    }

    let parsedData;
    try {
        parsedData = JSON.parse(qrData);
    } catch (e) {
        return res.status(400).json({ message: 'Invalid QR Data format' });
    }

    // Validate QR Data
    if (!parsedData.id || parsedData.role !== 'training_staff') {
        return res.status(400).json({ message: 'Invalid QR Code. Not a training staff QR.' });
    }

    const staffId = parsedData.id;
    const status = 'present'; // Default to present on scan

    // Check if record exists
    db.get('SELECT id, status FROM staff_attendance_records WHERE training_day_id = ? AND staff_id = ?', [dayId, staffId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
             // Already exists. Return success but mention it was already marked.
             return res.json({ message: 'Already marked present', staff: parsedData, status: row.status });
        } else {
            // Insert
            db.run('INSERT INTO staff_attendance_records (training_day_id, staff_id, status) VALUES (?, ?, ?)', 
                [dayId, staffId, status], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    res.json({ message: 'Attendance recorded', staff: parsedData, status: 'present' });
                }
            );
        }
    });
});

module.exports = router;
