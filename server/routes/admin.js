const express = require('express');
const { upload } = require('../utils/cloudinary');
const { authenticateToken, isAdmin, isAdminOrPrivilegedStaff } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const { sendEmail } = require('../utils/emailService');
const { processStaffData } = require('../utils/importCadets');
// const { upload } = require('../utils/cloudinary'); // Removed in favor of local memory storage

const router = express.Router();

// --- Search Cadets & Staff ---
router.get('/search', authenticateToken, isAdmin, async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);

    const searchTerm = `%${query}%`;
    const sql = `
        SELECT 'cadet' as type, id, first_name, last_name, rank, student_id as sub_info 
        FROM cadets 
        WHERE (first_name || ' ' || last_name) LIKE ? OR student_id LIKE ? OR last_name LIKE ?
        UNION ALL
        SELECT 'staff' as type, id, first_name, last_name, rank, email as sub_info 
        FROM training_staff 
        WHERE (first_name || ' ' || last_name) LIKE ? OR email LIKE ? OR last_name LIKE ?
        LIMIT 10
    `;

    db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).json({ message: 'Search failed' });
        }
        res.json(rows);
    });
});

router.get('/system-status', authenticateToken, isAdmin, (req, res) => {
    const start = Date.now();
    const results = {};

    const pGet = (sql, params = []) => new Promise((resolve) => {
        db.get(sql, params, (err, row) => {
            if (err) resolve({ error: err.message });
            else resolve(row || {});
        });
    });

    Promise.all([
        pGet('SELECT 1 as ok'),
        pGet('SELECT COUNT(*) as total FROM cadets'),
        pGet('SELECT COUNT(*) as total FROM users'),
        pGet('SELECT COUNT(*) as total FROM training_days'),
        pGet('SELECT COUNT(*) as total FROM activities'),
        pGet('SELECT COUNT(*) as total FROM notifications WHERE is_read = 0')
    ]).then(([dbCheck, cadets, users, trainingDays, activities, unreadNotifications]) => {
        const latencyMs = Date.now() - start;

        results.app = {
            status: 'ok',
            uptimeSeconds: Math.floor(process.uptime()),
            time: new Date().toISOString()
        };

        results.database = {
            status: dbCheck && !dbCheck.error ? 'ok' : 'error',
            latencyMs
        };

        results.metrics = {
            cadets: cadets && cadets.total !== undefined ? cadets.total : null,
            users: users && users.total !== undefined ? users.total : null,
            trainingDays: trainingDays && trainingDays.total !== undefined ? trainingDays.total : null,
            activities: activities && activities.total !== undefined ? activities.total : null,
            unreadNotifications: unreadNotifications && unreadNotifications.total !== undefined ? unreadNotifications.total : null
        };

        if (results.database.status !== 'ok') {
            results.app.status = 'degraded';
        }

        res.json(results);
    }).catch((err) => {
        res.status(500).json({
            app: {
                status: 'error',
                uptimeSeconds: Math.floor(process.uptime()),
                time: new Date().toISOString()
            },
            database: {
                status: 'error',
                error: err.message
            }
        });
    });
});

// SSE broadcast helper using global registry created in attendance routes
function broadcastEvent(event) {
    try {
        const clients = global.__sseClients || [];
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        clients.forEach((res) => {
            try { res.write(payload); } catch (e) { /* ignore */ }
        });
    } catch (e) {
        console.error('SSE broadcast error', e);
    }
}

// --- Import Helpers ---

const getCadetByStudentId = (studentId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM cadets WHERE student_id = ?', [studentId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getUserByCadetId = (cadetId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE cadet_id = ?', [cadetId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const insertCadet = (cadet) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO cadets (
            rank, first_name, middle_name, last_name, suffix_name, 
            student_id, email, contact_number, address, 
            course, year_level, school_year, 
            battalion, company, platoon, 
            cadet_course, semester, status,
            is_profile_completed, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.student_id, cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
            cadet.cadet_course || '', cadet.semester || '', 'Ongoing',
            false, false // Use booleans for Postgres compatibility
        ];

        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

const updateCadet = (id, cadet) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE cadets SET 
            rank = ?, first_name = ?, middle_name = ?, last_name = ?, suffix_name = ?, 
            email = ?, contact_number = ?, address = ?, 
            course = ?, year_level = ?, school_year = ?, 
            battalion = ?, company = ?, platoon = ?, 
            cadet_course = ?, semester = ?
            WHERE id = ?`;

        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
            cadet.cadet_course || '', cadet.semester || '',
            id
        ];

        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const upsertUser = (cadetId, studentId, email, customUsername, firstName) => {
    return new Promise(async (resolve, reject) => {
        try {
            const existingUser = await getUserByCadetId(cadetId);
            // Priority: Custom Username -> First Name -> Student ID
            const username = customUsername || firstName || studentId;
            
            if (!existingUser) {
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED'; 
                db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [username, dummyHash, 'cadet', cadetId, 1, email], 
                    (err) => {
                        if (err) {
                            if (err.message.includes('UNIQUE constraint failed')) {
                                console.warn(`Username ${username} already exists. Skipping user creation for ${studentId}.`);
                                resolve();
                            } else {
                                reject(err);
                            }
                        }
                        else {
                            // Initialize Grades
                            db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
                                if (err) console.error("Error initializing grades", err);
                                resolve();
                            });
                        }
                    }
                );
            } else {
                let sql = `UPDATE users SET email = ?, is_approved = ?`;
                const params = [email, 1];
                if (customUsername && customUsername !== existingUser.username) {
                    sql += `, username = ?`;
                    params.push(customUsername);
                }
                sql += ` WHERE id = ?`;
                params.push(existingUser.id);

                db.run(sql, params, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        } catch (err) {
            reject(err);
        }
    });
};

const findColumnValue = (row, possibleNames) => {
    const rowKeys = Object.keys(row);
    // Iterate through possible names first to prioritize them
    for (const name of possibleNames) {
        const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const key of rowKeys) {
            const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedKey === normalizedName) {
                const val = row[key];
                // Only return if value is not null/undefined
                if (val !== null && val !== undefined) return val;
            }
        }
    }
    return undefined;
};

const processCadetData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const row of data) {
        // Updated mapping to strictly follow user preferences
        const customUsername = findColumnValue(row, ['Username', 'username', 'User Name']);
        const email = findColumnValue(row, ['Email', 'email', 'E-mail', 'Email Address']);
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName', 'Given Name']);
        let lastName = findColumnValue(row, ['Last Name', 'last_name', 'LName', 'Surname']);
        let middleName = findColumnValue(row, ['Middle Name', 'middle_name', 'MName', 'Middle Initial']) || '';
        const rank = findColumnValue(row, ['Rank', 'rank', 'Grade']) || 'Cdt';
        let rawStudentId = findColumnValue(row, ['Student ID', 'student_id', 'ID', 'Student Number', 'USN']);
        
        // Handle "Name" or "Full Name" if separate fields are missing
        if (!firstName || !lastName) {
            const fullName = findColumnValue(row, ['Name', 'name', 'Full Name', 'Cadet Name']);
            if (fullName) {
                const parts = fullName.split(',').map(s => s.trim());
                if (parts.length >= 2) {
                    // Format: Last, First Middle
                    lastName = parts[0];
                    const rest = parts[1].split(' ');
                    firstName = rest[0];
                    middleName = rest.slice(1).join(' ');
                } else {
                    // Format: First Last (assuming last word is surname)
                    const spaceParts = fullName.split(' ');
                    if (spaceParts.length >= 2) {
                        lastName = spaceParts.pop();
                        firstName = spaceParts.join(' ');
                    } else {
                        firstName = fullName;
                        lastName = 'Unknown';
                    }
                }
            }
        }

        // Determine unique ID (Student ID > Username > Email > First Name hash)
        let studentId = rawStudentId || customUsername || email;
        
        if (!studentId && firstName) {
             studentId = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
        }

        if (!studentId) {
                    failCount++;
                    const availableKeys = Object.keys(row).join(', ');
                    errors.push(`Could not determine identity (Missing Student ID, Username, Email, or Name). Found columns: ${availableKeys}`);
                    continue;
                }

        const tempUsername = (studentId || '').toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        const cadetData = {
            student_id: studentId,
            last_name: lastName || 'Cadet',
            first_name: firstName || 'Unknown',
            middle_name: middleName,
            suffix_name: '',
            rank: rank,
            email: email || '',
            contact_number: '',
            address: '',
            course: '',
            year_level: '',
            school_year: '',
            battalion: '',
            company: '',
            platoon: '',
            cadet_course: '', 
            semester: ''
        };

        try {
            let cadetId;
            const existingCadet = await getCadetByStudentId(studentId);

            if (existingCadet) {
                cadetId = existingCadet.id;
                await updateCadet(cadetId, cadetData);
            } else {
                cadetId = await insertCadet(cadetData);
            }

            await upsertUser(cadetId, studentId, cadetData.email, customUsername, tempUsername);
            successCount++;
        } catch (err) {
            console.error(`Error processing ${studentId}:`, err);
            failCount++;
            errors.push(`${studentId}: ${err.message}`);
        }
    }
    return { successCount, failCount, errors };
};

router.use(authenticateToken);
router.use(isAdminOrPrivilegedStaff);

router.get('/locations', (req, res) => {
    const sql = `
        SELECT 
            u.id,
            u.username,
            u.role,
            u.cadet_id,
            u.staff_id,
            u.last_latitude,
            u.last_longitude,
            u.last_location_at,
            c.first_name AS cadet_first_name,
            c.last_name AS cadet_last_name,
            c.company AS cadet_company,
            c.platoon AS cadet_platoon,
            s.first_name AS staff_first_name,
            s.last_name AS staff_last_name,
            s.rank AS staff_rank,
            s.role AS staff_role
        FROM users u
        LEFT JOIN cadets c ON u.cadet_id = c.id
        LEFT JOIN training_staff s ON u.staff_id = s.id
        WHERE u.last_latitude IS NOT NULL
          AND u.last_longitude IS NOT NULL
          AND (u.is_archived IS FALSE OR u.is_archived IS NULL)
        ORDER BY u.last_location_at DESC
        LIMIT 200
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows || []);
    });
});



router.post('/cadet-email/send-template', authenticateToken, isAdmin, (req, res) => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        return res.status(500).json({
            message: 'Email sending is not configured on the server. Please set EMAIL_USER and EMAIL_PASS environment variables to enable cadet notification emails.'
        });
    }

    const { templateKey } = req.body || {};
    const allowedTemplates = ['cadet_general_update', 'cadet_training_reminder'];

    if (!templateKey || !allowedTemplates.includes(templateKey)) {
        return res.status(400).json({ message: 'Invalid or missing email template key.' });
    }

    const sql = `
        SELECT 
            c.id AS cadet_id,
            c.first_name,
            c.middle_name,
            c.last_name,
            c.student_id,
            u.username,
            u.email
        FROM cadets c
        JOIN users u ON c.id = u.cadet_id
        WHERE u.role = 'cadet'
          AND u.is_approved = 1
          AND u.email IS NOT NULL
          AND u.email <> ''
          AND (u.is_archived IS FALSE OR u.is_archived IS NULL)
          AND (c.is_archived IS FALSE OR c.is_archived IS NULL)
    `;

    db.all(sql, [], async (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: 'No eligible cadets with email found.' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const appUrl = `${baseUrl}/login`;

        const buildEmail = (key, cadet) => {
            const nameParts = [];
            if (cadet.first_name) nameParts.push(cadet.first_name);
            if (cadet.middle_name) nameParts.push(cadet.middle_name);
            if (cadet.last_name) nameParts.push(cadet.last_name);
            const fullName = nameParts.join(' ') || 'Cadet';
            const studentId = cadet.student_id || 'N/A';
            const username = cadet.username || 'N/A';

            if (key === 'cadet_general_update') {
                const subject = 'MSU-SND ROTC Grading System - Important Update';
                const textLines = [
                    `Dear ${fullName},`,
                    '',
                    'This is an official notification from the MSU-SND ROTC Grading Management System.',
                    'Please log in to the portal to review any new announcements, activities, or changes related to your ROTC participation.',
                    '',
                    `Student ID: ${studentId}`,
                    `Username: ${username}`,
                    `Email: ${cadet.email}`,
                    `Portal link: ${appUrl}`,
                    '',
                    'For security reasons, your password is not sent via email. Use your existing ROTC system password or contact your ROTC administrator if you cannot log in.',
                    '',
                    'Keep your login credentials secure and regularly monitor the system for updates.',
                    '',
                    'Best regards,',
                    'MSU-SND ROTC Administration'
                ];
                const text = textLines.join('\n');
                const html = `
                    <p>Dear <strong>${fullName}</strong>,</p>
                    <p>This is an official notification from the <strong>MSU-SND ROTC Grading Management System</strong>.</p>
                    <p>Please log in to the portal to review any new announcements, activities, or changes related to your ROTC participation.</p>
                    <p>
                        Student ID: <strong>${studentId}</strong><br/>
                        Username: <strong>${username}</strong><br/>
                        Email: <strong>${cadet.email}</strong><br/>
                        Portal link: <a href="${appUrl}">${appUrl}</a>
                    </p>
                    <p>
                        <em>For security reasons, your password is not sent via email. Use your existing ROTC system password or contact your ROTC administrator if you cannot log in.</em>
                    </p>
                    <p>Keep your login credentials secure and regularly monitor the system for updates.</p>
                    <p>
                        Best regards,<br/>
                        <strong>MSU-SND ROTC Administration</strong>
                    </p>
                `;
                return { subject, text, html };
            }

            if (key === 'cadet_training_reminder') {
                const subject = 'MSU-SND ROTC - Training and Activities Reminder';
                const textLines = [
                    `Dear ${fullName},`,
                    '',
                    'This is a reminder regarding your ROTC trainings and activities.',
                    'Please check the ROTC Grading Management System for your latest schedule, attendance status, and any new announcements.',
                    '',
                    'Make sure to:',
                    '• Review upcoming training days and requirements',
                    '• Monitor your attendance and performance',
                    '• Read all posted announcements and activities',
                    '',
                    `Portal link: ${appUrl}`,
                    '',
                    'Regular participation and awareness of updates are important for your standing in the ROTC program.',
                    '',
                    'Best regards,',
                    'MSU-SND ROTC Administration'
                ];
                const text = textLines.join('\n');
                const html = `
                    <p>Dear <strong>${fullName}</strong>,</p>
                    <p>
                        This is a reminder regarding your ROTC trainings and activities. Please check the
                        <strong>MSU-SND ROTC Grading Management System</strong> for your latest schedule,
                        attendance status, and any new announcements.
                    </p>
                    <p><strong>Make sure to:</strong></p>
                    <ul>
                        <li>Review upcoming training days and requirements</li>
                        <li>Monitor your attendance and performance</li>
                        <li>Read all posted announcements and activities</li>
                    </ul>
                    <p>
                        Portal link: <a href="${appUrl}">${appUrl}</a>
                    </p>
                    <p>
                        Regular participation and awareness of updates are important for your standing in the ROTC program.
                    </p>
                    <p>
                        Best regards,<br/>
                        <strong>MSU-SND ROTC Administration</strong>
                    </p>
                `;
                return { subject, text, html };
            }

            return null;
        };

        try {
            const tasks = rows.map((cadet) => {
                if (!cadet.email) return false;
                const emailContent = buildEmail(templateKey, cadet);
                if (!emailContent) return false;
                return sendEmail(cadet.email, emailContent.subject, emailContent.text, emailContent.html);
            });

            const results = await Promise.all(tasks);
            const successCount = results.filter(Boolean).length;
            const failCount = rows.length - successCount;

            if (successCount === 0) {
                return res.status(500).json({
                    message: 'Failed to send cadet notification emails. Please check email configuration (EMAIL_USER/EMAIL_PASS) and server logs.'
                });
            }

            res.json({ message: `Cadet notification email sent to ${successCount} cadets. Failed: ${failCount}.` });
        } catch (e) {
            console.error('Cadet notification email error:', e);
            res.status(500).json({ message: 'Failed to send cadet notification emails due to an unexpected server error.' });
        }
    });
});

// --- Import Official Cadet List ---

const getDirectDownloadUrl = (url) => {
    try {
        const urlObj = new URL(url);
        
        // Google Drive
            if (urlObj.hostname.includes('google.com')) {
                 // Google Sheets
                 if (urlObj.pathname.includes('/spreadsheets/')) {
                      return url.replace(/\/edit.*$/, '/export?format=xlsx');
                 }
            }

            // Dropbox
        if (urlObj.hostname.includes('dropbox.com')) {
             if (url.includes('dl=1')) return url;
             if (url.includes('dl=0')) return url.replace('dl=0', 'dl=1');
             const separator = url.includes('?') ? '&' : '?';
             return `${url}${separator}dl=1`;
        }

        // OneDrive / SharePoint / Office Online
        if (urlObj.hostname.includes('onedrive.live.com') || 
            urlObj.hostname.includes('sharepoint.com') || 
            urlObj.hostname.includes('1drv.ms') ||
            urlObj.hostname.includes('officeapps.live.com')) {
            
            // Case 1: /embed -> /download
            if (url.includes('/embed')) {
                return url.replace('/embed', '/download');
            }
            
            // Case 2: /view.aspx, /edit.aspx -> /download (Personal)
            if (url.includes('/view.aspx')) {
                return url.replace('/view.aspx', '/download');
            }
            if (url.includes('/edit.aspx')) {
                return url.replace('/edit.aspx', '/download');
            }

            // Case 3: /redir -> /download (Personal)
            if (url.includes('/redir')) {
                return url.replace('/redir', '/download');
            }
            
            // Case 4: Doc.aspx (Office Online / SharePoint)
            // e.g. .../Doc.aspx?sourcedoc=...&action=default
            if (url.includes('Doc.aspx')) {
                // If action param exists, replace it
                if (url.includes('action=')) {
                    return url.replace(/action=[^&]+/, 'action=download');
                } else {
                    // Append action=download
                    const separator = url.includes('?') ? '&' : '?';
                    return `${url}${separator}action=download`;
                }
            }

            // Case 5: Generic fallback (append download=1)
            // This works for many OneDrive/SharePoint sharing links that don't match above patterns
            if (!url.includes('download=1') && !url.includes('action=download')) {
                 const separator = url.includes('?') ? '&' : '?';
                 return `${url}${separator}download=1`;
            }
        }

        return url;
    } catch (e) {
        return url;
    }
};

const parsePdfBuffer = async (buffer) => {
    const data = [];
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    const lines = text.split('\n');
    
    lines.forEach(line => {
        const idMatch = line.match(/\b\d{4}[-]?\d{3,}\b/);
        if (idMatch) {
            const studentId = idMatch[0];
            const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            const email = emailMatch ? emailMatch[0] : '';
            let cleanLine = line.replace(studentId, '').replace(email, '').trim();
            let lastName = cleanLine;
            let firstName = '';
            let middleName = '';
            
            if (cleanLine.includes(',')) {
                const parts = cleanLine.split(',');
                lastName = parts[0].trim();
                const rest = parts.slice(1).join(' ').trim();
                firstName = rest;
            }
            data.push({
                'Student ID': studentId,
                'Email': email,
                'Last Name': lastName,
                'First Name': firstName,
                'Middle Name': middleName
            });
        }
    });

    if (data.length === 0) {
        throw new Error("No cadet records detected in PDF.");
    }

    return data;
};


router.post('/import-staff', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        let data = [];
        
        // Only Excel for now
        if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ message: 'PDF import not supported for staff. Please use Excel.' });
        } else {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                return res.status(400).json({ message: 'Excel file has no sheets' });
            }
            let aggregated = [];
            workbook.SheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const sheetData = xlsx.utils.sheet_to_json(sheet);
                aggregated = aggregated.concat(sheetData);
            });
            data = aggregated;
        }

        const result = await processStaffData(data);
        
        res.json({ 
            message: `Import complete. Success: ${result.successCount}, Failed: ${result.failCount}`,
            errors: result.errors.slice(0, 10)
        });

    } catch (error) {
        console.error('Staff Import error:', error);
        res.status(500).json({ message: 'Failed to process file' });
    }
});

router.post('/import-cadets', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        let data = [];
        
        if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                data = await parsePdfBuffer(req.file.buffer);
            } catch (err) {
                console.error("PDF Parse Error", err);
                return res.status(400).json({ message: 'Failed to parse PDF: ' + err.message });
            }
        } else {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                return res.status(400).json({ message: 'Excel file has no sheets' });
            }
            let aggregated = [];
            workbook.SheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const sheetData = xlsx.utils.sheet_to_json(sheet);
                aggregated = aggregated.concat(sheetData);
            });
            data = aggregated;
        }

        const result = await processCadetData(data);
        
        res.json({ 
            message: `Import complete. Success: ${result.successCount}, Failed: ${result.failCount}`,
            errors: result.errors.slice(0, 10)
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Failed to process file' });
    }
});

const processUrlImport = async (url) => {
    let currentUrl = getDirectDownloadUrl(url);
    console.log(`Original URL: ${url}`);
    console.log(`Initial Download URL: ${currentUrl}`);
    
    // Helper to fetch and validate
    const fetchFile = async (targetUrl) => {
        const response = await axios.get(targetUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            validateStatus: (status) => status < 400 || (status >= 300 && status < 400),
            maxRedirects: 0 // We handle redirects manually
        });
        return response;
    };

    try {
        let response;
        let buffer;
        let contentType;
        let redirectCount = 0;
        const maxRedirects = 10;

        while (redirectCount < maxRedirects) {
            console.log(`Fetching: ${currentUrl}`);
            response = await fetchFile(currentUrl);
            
            // Handle Redirects
            if (response.status >= 300 && response.status < 400 && response.headers.location) {
                redirectCount++;
                let redirectUrl = response.headers.location;
                
                // Handle relative URLs
                if (redirectUrl.startsWith('/')) {
                    const u = new URL(currentUrl);
                    redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                }

                console.log(`Redirecting to: ${redirectUrl}`);

                // --- KEY FIX: Check if we need to append download=1 to the redirect URL ---
                // If the redirect URL is a OneDrive/SharePoint URL and looks like a file path but lacks download=1
                // We assume it's redirecting to a viewer, so we force download=1.
                if ((redirectUrl.includes('onedrive.live.com') || redirectUrl.includes('sharepoint.com')) && 
                    !redirectUrl.includes('download=1')) {
                    
                    // Logic to detect if it's a file path (ends in .xlsx or similar)
                    const u = new URL(redirectUrl);
                    if (u.pathname.endsWith('.xlsx') || u.pathname.endsWith('.xls')) {
                        console.log("Redirect URL ends in .xlsx but missing download=1. Appending it.");
                        redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'download=1';
                    }
                }
                
                // Apply standard conversion logic (e.g. converting /redir or /view.aspx if they appear in redirect)
                const convertedUrl = getDirectDownloadUrl(redirectUrl);
                if (convertedUrl !== redirectUrl) {
                    console.log(`Converted redirect URL to: ${convertedUrl}`);
                    redirectUrl = convertedUrl;
                }

                currentUrl = redirectUrl;
                continue; // Loop again with new URL
            }

            // Success (200 OK)
            buffer = Buffer.from(response.data);
            contentType = response.headers['content-type'];
            console.log(`Response Content-Type: ${contentType}`);
            console.log(`Response Size: ${buffer.length} bytes`);

            // Check if we got HTML (Viewer)
            const firstBytes = buffer.slice(0, 100).toString().trim().toLowerCase();
            const isHtml = firstBytes.includes('<!doctype html') || 
                           firstBytes.includes('<html') || 
                           (contentType && contentType.toLowerCase().includes('html'));

            if (isHtml) {
                console.warn("Received HTML content. Checking heuristics...");
                
                // If we are at a OneDrive URL and got HTML, try appending download=1 if we haven't yet
                if ((currentUrl.includes('onedrive') || 
                     currentUrl.includes('sharepoint') || 
                     currentUrl.includes('1drv.ms') || 
                     currentUrl.includes('live.com')) && 
                    !currentUrl.includes('download=1') &&
                    !currentUrl.includes('export=download') &&
                    !currentUrl.includes('action=download')) {
                     
                     console.log("Got HTML from OneDrive. Trying to force download=1...");
                     currentUrl = currentUrl + (currentUrl.includes('?') ? '&' : '?') + 'download=1';
                     redirectCount++;
                     continue;
                }

                throw new Error(`The link returned a webpage (HTML) instead of a file. Content-Type: ${contentType}. URL: ${currentUrl}`);
            }

            break; // Got file!
        }

        if (redirectCount >= maxRedirects) {
            throw new Error("Too many redirects.");
        }
        
        let data = [];
        
        if (contentType && contentType.includes('pdf')) {
             try {
                data = await parsePdfBuffer(buffer);
            } catch (err) {
                 throw new Error('Failed to parse PDF from URL: ' + err.message);
            }
        } else {
            // Assume Excel
            try {
                const workbook = xlsx.read(buffer, { type: 'buffer' });
                if (workbook.SheetNames.length === 0) throw new Error("Excel file is empty");
                
                // Read all sheets
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const sheetData = xlsx.utils.sheet_to_json(sheet);
                    data = data.concat(sheetData);
                });
            } catch (err) {
                 console.error("Excel Parse Error:", err);
                 let msg = `Failed to parse Excel file. content-type: ${contentType}. Error: ${err.message}`;
                 if (err.message.includes('Invalid HTML')) {
                     msg += " (The URL likely points to a webpage instead of the file itself. Please use a direct download link.)";
                 }
                 throw new Error(msg);
            }
        }
        
        if (!data || data.length === 0) {
            throw new Error("No data found in the imported file.");
        }

        return await processCadetData(data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            if (err.response && err.response.status === 403) {
                 throw new Error(`Access Denied (403). The link might be private or require a login. Please make the link "Anyone with the link" or use a direct public link.`);
            }
            if (err.response && err.response.status === 404) {
                 const failedUrl = err.config?.url || 'the provided link';
                 throw new Error(`File not found (404). The server could not access the URL. Please ensure the link is correct and publicly accessible. (Failed at: ${failedUrl})`);
            }
             throw new Error(`Network/Connection Error: ${err.message}. Please check your internet connection and the link validity.`);
        }
        throw err;
    }
};

router.post('/import-cadets-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'No URL provided' });

    try {
        const result = await processUrlImport(url);

        // Save URL to Settings
        db.get("SELECT id FROM system_settings WHERE key = 'cadet_list_source_url'", [], (err, row) => {
            if (row) {
                db.run("UPDATE system_settings SET value = ? WHERE key = 'cadet_list_source_url'", [url]);
            } else {
                db.run("INSERT INTO system_settings (key, value) VALUES ('cadet_list_source_url', ?)", [url]);
            }
        });

        res.json({ 
            message: `Import complete. Success: ${result.successCount}, Failed: ${result.failCount}`,
            errors: result.errors.slice(0, 10)
        });

    } catch (err) {
        console.error('URL Import error:', err);
        res.status(500).json({ message: 'Failed to fetch or process file from URL: ' + err.message });
    }
});

router.post('/sync-cadets', async (req, res) => {
    db.get("SELECT value FROM system_settings WHERE key = 'cadet_list_source_url'", [], async (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row || !row.value) return res.status(404).json({ message: 'No linked source file found. Please import via URL first.' });
        
        try {
            const result = await processUrlImport(row.value);
            res.json({ 
                message: `Sync complete. Success: ${result.successCount}, Failed: ${result.failCount}`,
                errors: result.errors.slice(0, 10)
            });
        } catch (err) {
             console.error('Sync error:', err);
             res.status(500).json({ message: 'Sync failed: ' + err.message });
        }
    });
});

router.post('/cadet-notifications/weekly-reminder', authenticateToken, isAdmin, (req, res) => {
    const now = new Date();
    const defaultMessage = 'Reminder: Please prepare for ROTC formation tomorrow. Ensure your uniform and requirements are ready.';
    const message = (req.body && req.body.message && String(req.body.message).trim()) || defaultMessage;

    const sql = `
        SELECT u.id AS user_id
        FROM users u
        JOIN cadets c ON u.cadet_id = c.id
        WHERE u.role = 'cadet'
          AND (c.is_archived IS NULL OR c.is_archived = FALSE)
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!rows || rows.length === 0) return res.json({ message: 'No cadet users found for reminder.' });

        const stmt = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'weekly_reminder')`);
        rows.forEach(r => {
            if (r.user_id) {
                stmt.run([r.user_id, message]);
            }
        });
        stmt.finalize((finalizeErr) => {
            if (finalizeErr) return res.status(500).json({ message: finalizeErr.message });
            broadcastEvent({ type: 'cadet_notification', subtype: 'weekly_reminder', count: rows.length, sentAt: now.toISOString() });
            res.json({ message: `Weekly reminder notifications created for ${rows.length} cadets.`, count: rows.length, sentAt: now.toISOString() });
        });
    });
});

router.post('/cadet-notifications/general-update', authenticateToken, isAdmin, (req, res) => {
    const now = new Date();
    const defaultMessage = 'General update: Please check your dashboard for the latest announcements.';
    const message = (req.body && req.body.message && String(req.body.message).trim()) || defaultMessage;
    const sql = `
        SELECT u.id AS user_id
        FROM users u
        JOIN cadets c ON u.cadet_id = c.id
        WHERE u.role = 'cadet'
          AND (c.is_archived IS NULL OR c.is_archived = FALSE)
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!rows || rows.length === 0) return res.json({ message: 'No cadet users found for update.' });
        const stmt = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'general_update')`);
        rows.forEach(r => {
            if (r.user_id) {
                stmt.run([r.user_id, message]);
            }
        });
        stmt.finalize((finalizeErr) => {
            if (finalizeErr) return res.status(500).json({ message: finalizeErr.message });
            broadcastEvent({ type: 'cadet_notification', subtype: 'general_update', count: rows.length, sentAt: now.toISOString() });
            res.json({ message: `General update notifications created for ${rows.length} cadets.`, count: rows.length, sentAt: now.toISOString() });
        });
    });
});

router.post('/cadet-notifications/training-reminder', authenticateToken, isAdmin, (req, res) => {
    const now = new Date();
    const defaultMessage = 'Training reminder: Formation and training schedule are posted. Prepare accordingly.';
    const message = (req.body && req.body.message && String(req.body.message).trim()) || defaultMessage;
    const sql = `
        SELECT u.id AS user_id
        FROM users u
        JOIN cadets c ON u.cadet_id = c.id
        WHERE u.role = 'cadet'
          AND (c.is_archived IS NULL OR c.is_archived = FALSE)
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!rows || rows.length === 0) return res.json({ message: 'No cadet users found for training reminder.' });
        const stmt = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'training_reminder')`);
        rows.forEach(r => {
            if (r.user_id) {
                stmt.run([r.user_id, message]);
            }
        });
        stmt.finalize((finalizeErr) => {
            if (finalizeErr) return res.status(500).json({ message: finalizeErr.message });
            broadcastEvent({ type: 'cadet_notification', subtype: 'training_reminder', count: rows.length, sentAt: now.toISOString() });
            res.json({ message: `Training reminder notifications created for ${rows.length} cadets.`, count: rows.length, sentAt: now.toISOString() });
        });
    });
});

router.post('/import-cadets-remote', async (req, res) => {
    const { baseUrl, username, password } = req.body || {};
    if (!baseUrl || !username || !password) {
        return res.status(400).json({ message: 'baseUrl, username, and password are required' });
    }
    try {
        const loginRes = await axios.post(`${baseUrl}/api/auth/login`, { username, password });
        const token = loginRes.data?.token || loginRes.data?.accessToken;
        if (!token) return res.status(401).json({ message: 'Authentication to remote failed' });
        const listRes = await axios.get(`${baseUrl}/api/admin/cadets`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const remoteCadets = Array.isArray(listRes.data) ? listRes.data : [];
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        for (const c of remoteCadets) {
            try {
                const studentId = c.student_id || c.username || c.email || `${(c.last_name || 'cadet')}.${(c.first_name || 'user')}`.toLowerCase();
                const cadetData = {
                    student_id: studentId,
                    last_name: c.last_name || '',
                    first_name: c.first_name || '',
                    middle_name: c.middle_name || '',
                    suffix_name: c.suffix_name || '',
                    rank: c.rank || 'Cdt',
                    email: c.email || '',
                    contact_number: c.contact_number || '',
                    address: c.address || '',
                    course: c.course || '',
                    year_level: c.year_level || '',
                    school_year: c.school_year || '',
                    battalion: c.battalion || '',
                    company: c.company || '',
                    platoon: c.platoon || '',
                    cadet_course: c.cadet_course || '',
                    semester: c.semester || ''
                };
                let cadetId;
                const existingCadet = await getCadetByStudentId(studentId);
                if (existingCadet) {
                    cadetId = existingCadet.id;
                    await updateCadet(cadetId, cadetData);
                } else {
                    cadetId = await insertCadet(cadetData);
                }
                const tempUsername = (c.username || c.first_name || studentId || '').toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                await upsertUser(cadetId, studentId, cadetData.email, c.username, tempUsername);
                successCount++;
            } catch (e) {
                failCount++;
                errors.push(e.message);
            }
        }
        res.json({ message: `Import complete. Success: ${successCount}, Failed: ${failCount}`, errors: errors.slice(0, 10) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to import from remote: ' + (err.response?.data?.message || err.message) });
    }
});

router.get('/settings/cadet-source', (req, res) => {
    db.get("SELECT value FROM system_settings WHERE key = 'cadet_list_source_url'", [], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ url: row ? row.value : null });
    });
});

// PUT /api/admin/system-settings - Update system-wide settings (admin only)
router.put('/system-settings', (req, res) => {
    const {
        email_alerts,
        push_notifications,
        activity_updates,
        dark_mode,
        compact_mode,
        primary_color
    } = req.body || {};
    
    const entries = [
        { key: 'email_alerts_default', value: email_alerts },
        { key: 'push_notifications_default', value: push_notifications },
        { key: 'activity_updates_default', value: activity_updates },
        { key: 'dark_mode_default', value: dark_mode },
        { key: 'compact_mode_default', value: compact_mode },
        { key: 'primary_color', value: primary_color || 'blue' }
    ];
    
    const upsert = (key, value) => new Promise((resolve, reject) => {
        // Normalize booleans to '1'/'0' strings for consistency across DBs
        let val = value;
        if (typeof value === 'boolean') val = value ? '1' : '0';
        db.get("SELECT id FROM system_settings WHERE key = ?", [key], (err, row) => {
            if (err) return reject(err);
            if (row) {
                db.run("UPDATE system_settings SET value = ? WHERE key = ?", [val, key], (uErr) => {
                    if (uErr) return reject(uErr);
                    resolve();
                });
            } else {
                db.run("INSERT INTO system_settings (key, value) VALUES (?, ?)", [key, val], (iErr) => {
                    if (iErr) return reject(iErr);
                    resolve();
                });
            }
        });
    });
    
    Promise.all(entries.map(e => upsert(e.key, e.value)))
        .then(() => res.json({ message: 'System settings updated' }))
        .catch((error) => res.status(500).json({ message: error.message }));
});

// Helper: Transmuted Grade Logic
const calculateTransmutedGrade = (finalGrade, status) => {
    // Priority to status
    if (status && ['DO', 'INC', 'T'].includes(status)) {
        return { transmutedGrade: status, remarks: 'Failed' };
    }

    let transmutedGrade = 5.00;
    let remarks = 'Failed';

    // 98-100 = 1.00
    if (finalGrade >= 98) { transmutedGrade = 1.00; remarks = 'Passed'; }
    else if (finalGrade >= 95) { transmutedGrade = 1.25; remarks = 'Passed'; }
    else if (finalGrade >= 92) { transmutedGrade = 1.50; remarks = 'Passed'; }
    else if (finalGrade >= 89) { transmutedGrade = 1.75; remarks = 'Passed'; }
    else if (finalGrade >= 86) { transmutedGrade = 2.00; remarks = 'Passed'; }
    else if (finalGrade >= 83) { transmutedGrade = 2.25; remarks = 'Passed'; }
    else if (finalGrade >= 80) { transmutedGrade = 2.50; remarks = 'Passed'; }
    else if (finalGrade >= 77) { transmutedGrade = 2.75; remarks = 'Passed'; }
    else if (finalGrade >= 75) { transmutedGrade = 3.00; remarks = 'Passed'; }
    
    return { transmutedGrade: typeof transmutedGrade === 'number' ? transmutedGrade.toFixed(2) : transmutedGrade, remarks };
};

// --- Analytics ---

// Get Dashboard Analytics
router.get('/analytics', (req, res) => {
    const analyticsData = {
        attendance: [],
        grades: { passed: 0, failed: 0, incomplete: 0 }
    };

    // 1. Get Attendance Stats (Last 10 training days)
    const attendanceSql = `
        SELECT 
            td.date, 
            COUNT(CASE WHEN ar.status = 'Present' THEN 1 END) as present,
            COUNT(CASE WHEN ar.status = 'Absent' THEN 1 END) as absent
        FROM training_days td
        LEFT JOIN attendance_records ar ON td.id = ar.training_day_id
        GROUP BY td.id
        ORDER BY td.date DESC
        LIMIT 10
    `;

    db.all(attendanceSql, [], (err, attendanceRows) => {
        if (err) return res.status(500).json({ message: err.message });
        
        analyticsData.attendance = attendanceRows.reverse(); // Show oldest to newest in chart

        // Get Total Training Days for Calculation
        db.get("SELECT COUNT(*) as total FROM training_days", [], (err, countRow) => {
            if (err) return res.status(500).json({ message: err.message });
            const totalTrainingDays = countRow.total || 15; // Default to 15 if 0 to avoid division by zero (or handle gracefully)

    // 2. Get Grade Stats (Optimize: Only fetch grade columns, exclude profile_pic/cadet info)
            const gradesSql = `
                SELECT g.attendance_present, g.merit_points, g.demerit_points, 
                       g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status
                FROM grades g
                JOIN users u ON u.cadet_id = g.cadet_id
                WHERE u.is_approved = 1
            `;

            db.all(gradesSql, [], (err, gradeRows) => {
                if (err) return res.status(500).json({ message: err.message });

                gradeRows.forEach(gradeData => {
                    const safeTotalDays = totalTrainingDays > 0 ? totalTrainingDays : 1;
                    const attendanceScore = (gradeData.attendance_present / safeTotalDays) * 30;
                    
                    // Aptitude: Base 100 + Merits - Demerits (Capped at 100)
                    let rawAptitude = 100 + (gradeData.merit_points || 0) - (gradeData.demerit_points || 0);
                    if (rawAptitude > 100) rawAptitude = 100;
                    if (rawAptitude < 0) rawAptitude = 0; 
                    
                    const aptitudeScore = rawAptitude * 0.3;

                    // Subject Proficiency: (Sum / Total Items) * 40%
                    const subjectScore = ((gradeData.prelim_score + gradeData.midterm_score + gradeData.final_score) / 300) * 40;
                    
                    const finalGrade = attendanceScore + aptitudeScore + subjectScore;
                    
                    const { remarks } = calculateTransmutedGrade(finalGrade, gradeData.grade_status);

                    if (remarks === 'Passed') analyticsData.grades.passed++;
                    else if (remarks === 'Failed') analyticsData.grades.failed++;
                    
                    if (['INC', 'DO', 'T'].includes(gradeData.grade_status)) {
                        analyticsData.grades.incomplete++;
                        if (remarks === 'Failed') analyticsData.grades.failed--; // Adjust if it was counted as failed above
                    }
                });

                // 3. Get Demographics (Company, Rank, Status) - Replaces client-side aggregation
                const demographicsQueries = [
                    new Promise((resolve, reject) => {
                        db.all("SELECT company, COUNT(*) as count FROM cadets GROUP BY company", [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'company', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        db.all("SELECT rank, COUNT(*) as count FROM cadets GROUP BY rank", [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'rank', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        db.all("SELECT status, COUNT(*) as count FROM cadets GROUP BY status", [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'status', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        const sql = `
                            SELECT c.cadet_course, c.status, COUNT(*) as count 
                            FROM cadets c
                            LEFT JOIN users u ON u.cadet_id = c.id
                            WHERE c.is_profile_completed IS TRUE AND c.cadet_course IS NOT NULL AND c.cadet_course != ''
                            GROUP BY c.cadet_course, c.status
                        `;
                        db.all(sql, [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'course_stats', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        db.get("SELECT COUNT(*) as total FROM cadets", [], (err, row) => {
                            if (err) reject(err); else resolve({ type: 'total', count: row.total });
                        });
                    })
                ];

                Promise.all(demographicsQueries)
                    .then(results => {
                        const demographics = { company: [], rank: [], status: [], courseStats: [], totalCadets: 0 };
                        
                        results.forEach(result => {
                            if (result.type === 'total') {
                                demographics.totalCadets = result.count;
                            } else if (result.type === 'company') {
                                // Map company names logic
                                const companyMap = {};
                                result.rows.forEach(r => {
                                    let name = r.company ? r.company.trim() : '';
                                    if (name === '. . . . . . . .' || name === '') name = 'Advance Officer';
                                    if (!name) name = 'Unverified'; // Fallback if still empty (shouldn't be reached given above)
                                    companyMap[name] = (companyMap[name] || 0) + r.count;
                                });
                                demographics.company = Object.keys(companyMap).map(k => ({ name: k, count: companyMap[k] }));
                            } else if (result.type === 'rank') {
                                demographics.rank = result.rows.map(r => ({ name: r.rank || 'Unverified', count: r.count }));
                            } else if (result.type === 'status') {
                                demographics.status = result.rows.map(r => ({ name: r.status || 'Unverified', value: r.count }));
                            } else if (result.type === 'course_stats') {
                                demographics.courseStats = result.rows;
                            }
                        });

                        analyticsData.demographics = demographics;
                        res.json(analyticsData);
                    })
                    .catch(err => {
                         console.error("Demographics error:", err);
                         // Return partial data if demographics fail
                         res.json(analyticsData);
                    });
            });
        });
    });
});

// --- Cadet Management ---

// Create Single Cadet (Manual Add)
router.post('/cadets', async (req, res) => {
    const cadet = req.body;
    
    // Validate required fields
    if (!cadet.studentId || !cadet.lastName || !cadet.firstName) {
        return res.status(400).json({ message: 'Student ID, Last Name, and First Name are required' });
    }

    try {
        // Check if student ID exists
        const checkSql = 'SELECT id FROM cadets WHERE student_id = ?';
        db.get(checkSql, [cadet.studentId], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row) return res.status(400).json({ message: 'Cadet with this Student ID already exists' });

            // Insert Cadet
            const insertSql = `INSERT INTO cadets (
                rank, first_name, middle_name, last_name, suffix_name, 
                student_id, email, contact_number, address, 
                course, year_level, school_year, 
                battalion, company, platoon, 
                cadet_course, semester, corp_position, status, is_profile_completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                cadet.rank || '', cadet.firstName || '', cadet.middleName || '', cadet.lastName || '', cadet.suffixName || '',
                cadet.studentId, cadet.email || '', cadet.contactNumber || '', cadet.address || '',
                cadet.course || '', cadet.yearLevel || '', cadet.schoolYear || '',
                cadet.battalion || '', cadet.company || '', cadet.platoon || '',
                cadet.cadetCourse || '', cadet.semester || '', cadet.corpPosition || '', cadet.status || 'Ongoing', 0
            ];

            db.run(insertSql, params, function(err) {
                if (err) return res.status(500).json({ message: err.message });
                const newCadetId = this.lastID;

                // Create User Account (Auto-approved)
                const baseUsername = cadet.firstName || cadet.studentId; // Default to First Name
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
                
                const insertUser = (uName) => {
                    db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                        [uName, dummyHash, 'cadet', newCadetId, 1, cadet.email || ''], 
                        (err) => {
                            if (err) {
                                // Handle duplicate username error
                                if (err.message.includes('UNIQUE constraint') || err.message.includes('duplicate key') || err.message.includes('users_username_key')) {
                                    console.log(`Username ${uName} taken, trying new one...`);
                                    const newUsername = baseUsername + Math.floor(Math.random() * 10000);
                                    insertUser(newUsername);
                                } else {
                                    console.error("Error creating user for new cadet:", err);
                                    return res.status(500).json({ message: 'Error creating user account: ' + err.message });
                                }
                            } else {
                                // Initialize Grades
                                db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [newCadetId], (err) => {
                                    if (err) console.error("Error initializing grades:", err);
                                    res.status(201).json({ message: 'Cadet created successfully', id: newCadetId });
                                });
                            }
                        }
                    );
                };

                insertUser(baseUsername);
            });
        });
    } catch (error) {
        console.error("Create cadet error:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get All Cadets (with computed grades) - ONLY APPROVED
router.get('/cadets', (req, res) => {
    // 1. Get Total Training Days first
    db.get("SELECT COUNT(*) as total FROM training_days", [], (err, countRow) => {
        if (err) return res.status(500).json({ message: err.message });
        const totalTrainingDays = countRow.total || 15; // Default to 15 if 0

        const sql = `
            SELECT c.id, c.rank, c.first_name, c.middle_name, c.last_name, c.suffix_name,
                   c.student_id, c.email, c.contact_number, c.address, 
                   c.course, c.year_level, c.school_year, 
                   c.battalion, c.company, c.platoon, 
                   c.cadet_course, c.semester, c.corp_position, c.status, c.is_profile_completed,
                   u.username,
                   g.attendance_present, g.merit_points, g.demerit_points, 
                   g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status
            FROM cadets c
            LEFT JOIN users u ON u.cadet_id = c.id
            LEFT JOIN grades g ON c.id = g.cadet_id
            WHERE (c.is_archived IS FALSE OR c.is_archived IS NULL)
        `;
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            
            // Calculate grades for each cadet
            const cadetsWithGrades = rows.map(cadet => {
                const safeTotalDays = totalTrainingDays > 0 ? totalTrainingDays : 1;
                const attendanceScore = (cadet.attendance_present / safeTotalDays) * 30; // 30%
                
                // Aptitude: Base 100 + Merits - Demerits (Capped at 100, Floor 0)
                let rawAptitude = 100 + (cadet.merit_points || 0) - (cadet.demerit_points || 0);
                if (rawAptitude > 100) rawAptitude = 100;
                if (rawAptitude < 0) rawAptitude = 0;
                const aptitudeScore = rawAptitude * 0.3;

                // Subject: (Sum / 300) * 40%
                const subjectScore = ((cadet.prelim_score + cadet.midterm_score + cadet.final_score) / 300) * 40; // 40%

                const finalGrade = attendanceScore + aptitudeScore + subjectScore;
                
                // Use grade_status from join, not cadet.status (which is enrollment status)
                const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, cadet.grade_status);

                return {
                    ...cadet,
                    attendanceScore,
                    aptitudeScore,
                    subjectScore,
                    finalGrade,
                    transmutedGrade,
                    remarks
                };
            });

            res.json(cadetsWithGrades);
        });
    });
});

// Update Cadet Personal Info
router.put('/cadets/:id', authenticateToken, isAdmin, upload.single('profilePic'), (req, res) => {
    const { 
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status,
        username
    } = req.body;

    const profilePic = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;

    const setFields = [
        'rank = ?',
        'first_name = ?',
        'middle_name = ?',
        'last_name = ?',
        'suffix_name = ?',
        'student_id = ?',
        'email = ?',
        'contact_number = ?',
        'address = ?',
        'course = ?',
        'year_level = ?',
        'school_year = ?',
        'battalion = ?',
        'company = ?',
        'platoon = ?',
        'cadet_course = ?',
        'semester = ?',
        'corp_position = ?',
        'status = ?'
    ];

    const params = [
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, req.body.corpPosition || '', status
    ];

    if (profilePic) {
        setFields.push('profile_pic = ?');
        params.push(profilePic);
    }

    params.push(req.params.id);

    const sql = `UPDATE cadets SET ${setFields.join(', ')} WHERE id = ?`;

    db.run(sql, params, (err) => {
            if (err) return res.status(500).json({ message: err.message });
            
            // Sync with Users table (Email/Username)
            // Update email and username if provided
            if (email || username) {
                let updateFields = [];
                let updateParams = [];

                if (email) {
                    updateFields.push("email = ?");
                    updateParams.push(email);
                }
                if (username) {
                    updateFields.push("username = ?");
                    updateParams.push(username);
                }

                if (updateFields.length > 0) {
                    updateParams.push(req.params.id);
                    const userSql = `UPDATE users SET ${updateFields.join(", ")} WHERE cadet_id = ?`;
                    
                    db.run(userSql, updateParams, (uErr) => {
                        if (uErr) {
                            console.error("Error syncing user credentials:", uErr);
                            // If username is taken, this might fail silently or we should warn?
                            // For now we log it. In a real app we might want to return a warning.
                        }
                    });
                }
            }

            res.json({ message: 'Cadet updated' });
        }
    );
});

// Delete Cadet (Bulk)
router.post('/cadets/delete', async (req, res) => {
    const { ids } = req.body; // Expecting array of IDs
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');

    // Helper to wrap db.run in Promise
    const runQuery = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this ? this.changes : 0);
            });
        });
    };

    try {
        // Delete related records first (manual cascade) to ensure cleanup
        // Note: Even if Foreign Keys are ON, explicit deletes are safer in mixed envs
        await runQuery(`DELETE FROM grades WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM users WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM merit_demerit_logs WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM attendance_records WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM excuse_letters WHERE cadet_id IN (${placeholders})`, ids);
        
        // Finally delete cadets
        const changes = await runQuery(`DELETE FROM cadets WHERE id IN (${placeholders})`, ids);
        
        res.json({ message: `Deleted ${changes} cadets and related records` });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ message: 'Failed to delete cadets: ' + err.message });
    }
});

// --- Grading Management ---

// Update Grades for a Cadet
router.put('/grades/:cadetId', (req, res) => {
    const { meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status, attendancePresent } = req.body;
    const cadetId = req.params.cadetId;

    // Check if row exists, if not create it
    db.get("SELECT id, merit_points, demerit_points FROM grades WHERE cadet_id = ?", [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        
        const runUpdate = (currentMerit, currentDemerit) => {
            db.run(`UPDATE grades SET 
                    attendance_present = ?,
                    merit_points = ?, 
                    demerit_points = ?, 
                    prelim_score = ?, 
                    midterm_score = ?, 
                    final_score = ?,
                    status = ?
                    WHERE cadet_id = ?`,
                [attendancePresent, meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status || 'active', cadetId],
                function(err) {
                    if (err) return res.status(500).json({ message: err.message });
                    
                    // Sync Logs: Create manual adjustment logs if points changed
                    const meritDiff = (meritPoints || 0) - (currentMerit || 0);
                    const demeritDiff = (demeritPoints || 0) - (currentDemerit || 0);
                    
                    const logPromises = [];
                    if (meritDiff !== 0) {
                        logPromises.push(new Promise(resolve => {
                            db.run(`INSERT INTO merit_demerit_logs (cadet_id, type, points, reason) VALUES (?, 'merit', ?, 'Manual Adjustment by Admin')`, 
                                [cadetId, meritDiff], resolve);
                        }));
                    }
                    if (demeritDiff !== 0) {
                        logPromises.push(new Promise(resolve => {
                            db.run(`INSERT INTO merit_demerit_logs (cadet_id, type, points, reason) VALUES (?, 'demerit', ?, 'Manual Adjustment by Admin')`, 
                                [cadetId, demeritDiff], resolve);
                        }));
                    }
                    
                    Promise.all(logPromises).then(() => {
                        db.get(`SELECT id, email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], async (err, cadet) => {
                            if (!err && cadet && cadet.email) {
                                const subject = 'ROTC Grading System - Grades Updated';
                                const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nYour grades have been updated by the admin.\n\nPlease log in to the portal to view your latest standing.\n\nRegards,\nROTC Admin`;
                                const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>Your grades have been updated by the admin.</p><p>Please log in to the portal to view your latest standing.</p><p>Regards,<br>ROTC Admin</p>`;
                                
                                await sendEmail(cadet.email, subject, text, html);

                                db.get(`SELECT id FROM users WHERE cadet_id = ? AND role = 'cadet'`, [cadetId], (uErr, userRow) => {
                                    if (!uErr && userRow && userRow.id) {
                                        const notifMessage = 'Your grades have been updated. Please check your portal.';
                                        db.run(
                                            `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`,
                                            [userRow.id, notifMessage, 'grade'],
                                            (nErr) => {
                                                if (nErr) console.error('Error creating grade notification:', nErr);
                                            }
                                        );
                                    }
                                    broadcastEvent({ type: 'grade_updated', cadetId });
                                    res.json({ message: 'Grades updated' });
                                });
                            } else {
                                broadcastEvent({ type: 'grade_updated', cadetId });
                                res.json({ message: 'Grades updated' });
                            }
                        });
                    });
                }
            );
        };

        if (!row) {
            // Initialize with defaults if missing
            db.run(`INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status) 
                    VALUES (?, 0, 0, 0, 0, 0, 0, 'active')`, [cadetId], (err) => {
                if (err) return res.status(500).json({ message: err.message });
                runUpdate(0, 0);
            });
        } else {
            runUpdate(row.merit_points, row.demerit_points);
        }
    });
});

// --- Notifications (Admin scope) ---
router.get('/notifications', authenticateToken, isAdmin, (req, res) => {
    const userId = req.user.id;
    const sql = `SELECT * FROM notifications WHERE (user_id IS NULL OR user_id = ?) ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

router.delete('/notifications/:id', authenticateToken, isAdmin, (req, res) => {
    db.run(`DELETE FROM notifications WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Notification deleted' });
    });
});

router.delete('/notifications/delete-all', authenticateToken, isAdmin, (req, res) => {
    const userId = req.user.id;
    db.run(`DELETE FROM notifications WHERE (user_id IS NULL OR user_id = ?)`, [userId], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All notifications deleted' });
    });
});

// --- Activity Management ---

// Upload Activity
router.post('/activities', upload.array('images', 10), (req, res) => {
    const { title, description, date, type } = req.body;
    
    let images = [];
    if (req.files && req.files.length > 0) {
        images = req.files.map(file => {
            // Cloudinary returns a secure URL directly in file.path
            if (file.path && (file.path.startsWith('http') || file.path.startsWith('https'))) {
                return file.path;
            }
            // Local fallback: file.path is an absolute path. Convert to relative URL.
            // Assuming file is saved in 'server/uploads' and served via '/uploads'
            if (file.filename) {
                return `/uploads/${file.filename}`;
            }
            // Fallback for memory storage (if ever reverted)
            if (file.buffer) {
                return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            }
            return null;
        }).filter(Boolean);
    }

    const activityType = type || 'activity';
    
    // Server-side validation for image count
    if (activityType === 'activity' && images.length < 3) {
        return res.status(400).json({ message: 'Activities require at least 3 photos.' });
    }

    const imagesJson = JSON.stringify(images);
    const primaryImage = images[0] || null;

    db.run(`INSERT INTO activities (title, description, date, image_path, images, type) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description, date, primaryImage, imagesJson, activityType],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            const activityId = this.lastID;
            // Create notification for the new activity
            const notifMsg = `New ${activityType === 'announcement' ? 'Announcement' : 'Activity'} Posted: ${title}`;
            db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, 'activity')`, 
                [notifMsg], 
                (nErr) => {
                    if (nErr) console.error("Error creating activity notification:", nErr);
                    res.json({ id: activityId, message: 'Activity created' });
                }
            );
        });
});

// Delete Activity
router.delete('/activities/:id', (req, res) => {
    db.run(`DELETE FROM activities WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Activity deleted' });
    });
});

// --- User Management (Approvals) ---

// Get Users (filter by pending)
router.get('/users', (req, res) => {
    const { pending } = req.query;
    let sql = `SELECT u.id, u.username, u.role, u.is_approved, u.email, 
                      c.first_name, c.last_name, c.student_id 
               FROM users u
               LEFT JOIN cadets c ON u.cadet_id = c.id`;
    
    // Debug log to check database queries
    console.log(`Fetching users with pending=${pending}`);

    const params = [];
    if (pending === 'true') {
        sql += ` WHERE u.is_approved = 0`;
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ message: err.message });
        }
        console.log(`Found ${rows.length} users`);
        res.json(rows);
    });
});

// Approve User
router.put('/users/:id/approve', (req, res) => {
    db.run(`UPDATE users SET is_approved = 1 WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        // Ensure grades record exists for the approved cadet
        db.get("SELECT cadet_id, email FROM users WHERE id = ?", [req.params.id], (err, user) => {
            if (user && user.cadet_id) {
                db.run("INSERT OR IGNORE INTO grades (cadet_id) VALUES (?)", [user.cadet_id], (err) => {
                    if (err) console.error("Error creating grades record:", err);
                });
                
                // Optional: Send welcome email
                if (user.email) {
                    sendEmail(
                        user.email, 
                        'Account Approved - ROTC Grading System',
                        'Your account has been approved. You can now login.',
                        '<p>Your account has been approved. You can now login.</p>'
                    );
                }
            }
        });

        res.json({ message: 'User approved' });
    });
});

// Delete User (Reject)
router.delete('/users/:id', (req, res) => {
    db.get("SELECT cadet_id FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        
        db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            if (row && row.cadet_id) {
                db.run(`DELETE FROM cadets WHERE id = ?`, [row.cadet_id], (err) => {
                   if (err) console.error("Error deleting cadet info", err);
                });
            }
            res.json({ message: 'User rejected/deleted' });
        });
    });
});

// --- Admin Profile ---
//
// Get Current Admin Profile
router.get('/profile', authenticateToken, isAdmin, (req, res) => {
    db.get(`SELECT id, username, email, profile_pic FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(row);
    });
});

// Update Admin Profile (Pic)
router.put('/profile', authenticateToken, isAdmin, upload.single('profilePic'), (req, res) => {
    const profilePic = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
    
    if (profilePic) {
        db.run(`UPDATE users SET profile_pic = ? WHERE id = ?`, [profilePic, req.user.id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Profile updated', profilePic });
        });
    } else {
        res.status(400).json({ message: 'No file uploaded' });
    }
});

// --- Merit/Demerit Ledger ---

// Get Logs for a Cadet
router.get('/merit-logs/:cadetId', (req, res) => {
    const sql = `SELECT * FROM merit_demerit_logs WHERE cadet_id = ? ORDER BY date_recorded DESC`;
    db.all(sql, [req.params.cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Add Log Entry (and update Total)
router.post('/merit-logs', (req, res) => {
    const { cadetId, type, points, reason } = req.body;
    
    // 1. Insert Log
    db.run(`INSERT INTO merit_demerit_logs (cadet_id, type, points, reason) VALUES (?, ?, ?, ?)`, 
        [cadetId, type, points, reason], 
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            // 2. Update Total in Grades
            const column = type === 'merit' ? 'merit_points' : 'demerit_points';
            
            const updateGrades = () => {
                db.run(`UPDATE grades SET ${column} = ${column} + ? WHERE cadet_id = ?`, [points, cadetId], (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    
                    // 3. Send Email Notification
                    db.get(`SELECT email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], async (err, cadet) => {
                        if (!err && cadet && cadet.email) {
                            const subject = `ROTC System - New ${type === 'merit' ? 'Merit' : 'Demerit'} Record`;
                            const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nA new ${type} record has been added to your profile.\nPoints: ${points}\nReason: ${reason}\n\nPlease check your dashboard for details.\n\nRegards,\nROTC Admin`;
                            const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>A new <strong>${type}</strong> record has been added to your profile.</p><ul><li><strong>Points:</strong> ${points}</li><li><strong>Reason:</strong> ${reason}</li></ul><p>Please check your dashboard for details.</p><p>Regards,<br>ROTC Admin</p>`;
                            
                            await sendEmail(cadet.email, subject, text, html);
                        }
                        broadcastEvent({ type: 'grade_updated', cadetId });
                        res.json({ message: 'Log added and points updated' });
                    });
                });
            };
            
            db.get(`SELECT id FROM grades WHERE cadet_id = ?`, [cadetId], (err, row) => {
                if (!row) {
                    // Create grade row first
                    db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
                        if (err) return res.status(500).json({ message: 'Failed to init grades' });
                        updateGrades();
                    });
                } else {
                    updateGrades();
                }
            });
        }
    );
});

// Delete Merit/Demerit Log
router.delete('/merit-logs/:id', (req, res) => {
    const logId = req.params.id;

    // 1. Get the log details first to know what to subtract
    db.get(`SELECT * FROM merit_demerit_logs WHERE id = ?`, [logId], (err, log) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!log) return res.status(404).json({ message: 'Log not found' });

        // 2. Delete the log
        db.run(`DELETE FROM merit_demerit_logs WHERE id = ?`, [logId], (err) => {
            if (err) return res.status(500).json({ message: err.message });

            // 3. Reverse the points in grades table
            const column = log.type === 'merit' ? 'merit_points' : 'demerit_points';
            
            db.run(`UPDATE grades SET ${column} = ${column} - ? WHERE cadet_id = ?`, [log.points, log.cadet_id], (err) => {
                if (err) console.error("Error updating grades after log deletion", err);
                broadcastEvent({ type: 'grade_updated', cadetId: log.cadet_id });
                res.json({ message: 'Log deleted and points reverted' });
            });
        });
    });
});

// --- Notifications ---

// Get Notifications (Admin)
router.get('/notifications', (req, res) => {
    // Fetch notifications where user_id is NULL (system/admin) or matches admin's ID
    const sql = `SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark Notification as Read
router.put('/notifications/:id/read', (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// Mark All Notifications as Read
router.put('/notifications/read-all', (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All marked as read' });
    });
});

// Clear All Notifications
router.delete('/notifications', (req, res) => {
    db.run(`DELETE FROM notifications WHERE user_id IS NULL OR user_id = ?`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Notifications cleared' });
    });
});

// Get Online Users Count
router.get('/online-users', (req, res) => {
    // 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Count users with last_seen > 5 mins ago
    // AND role = 'cadet' (per user request: "how many cadets access the system")
    const sql = `SELECT COUNT(*) as count FROM users WHERE last_seen > ? AND role = 'cadet'`;
    
    db.get(sql, [fiveMinutesAgo], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ count: row.count || 0 });
    });
});

// --- Backup & Archiving ---

// 1. Download Full Database Backup (JSON)
router.get('/backup/download', authenticateToken, isAdmin, async (req, res) => {
    try {
        const backup = {
            timestamp: new Date().toISOString(),
            data: {}
        };
        
        const tables = [
            'cadets', 'users', 'grades', 'activities', 'merit_demerit_logs', 
            'training_days', 'attendance_records', 'training_staff', 'staff_attendance_records',
            'notifications', 'staff_messages'
        ];
        
        // Fetch all tables sequentially
        for (const table of tables) {
            backup.data[table] = await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
                    if (err) resolve([]); // Ignore errors (e.g. table missing)
                    else resolve(rows);
                });
            });
        }
        
        const fileName = `rotc-backup-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(backup, null, 2));
    } catch (err) {
        console.error("Backup error:", err);
        res.status(500).json({ message: 'Backup failed: ' + err.message });
    }
});

// 2. Archive Cadets
router.post('/cadets/archive', authenticateToken, isAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    db.run(`UPDATE cadets SET is_archived = TRUE WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Archived ${this.changes} cadets` });
    });
});

// --- NEW: Export & Prune Completed Cadets ---

// Export Completed Cadets to Excel
router.get('/cadets/export-completed', authenticateToken, isAdmin, (req, res) => {
    try {
        const sql = `SELECT * FROM cadets WHERE status = 'Completed'`;
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            if (rows.length === 0) return res.status(404).json({ message: 'No completed cadets found to export.' });

            // Create Workbook
            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.json_to_sheet(rows);
            xlsx.utils.book_append_sheet(wb, ws, "Graduates");

            // Write to buffer
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

            // Send response
            res.setHeader('Content-Disposition', 'attachment; filename="Graduates_Archive.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        });
    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Delete Completed Cadets
router.delete('/cadets/prune-completed', authenticateToken, isAdmin, (req, res) => {
    const sql = `DELETE FROM cadets WHERE status = 'Completed'`;
    db.run(sql, [], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Successfully removed ${this.changes} completed cadets from the database.` });
    });
});
// --------------------------------------------

// 3. Restore Cadets
router.post('/cadets/restore', authenticateToken, isAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    db.run(`UPDATE cadets SET is_archived = FALSE WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Restored ${this.changes} cadets` });
    });
});

// 4. Get Archived Cadets
router.get('/cadets/archived', authenticateToken, isAdmin, (req, res) => {
    const sql = `
        SELECT c.*, u.username
        FROM cadets c
        LEFT JOIN users u ON u.cadet_id = c.id
        WHERE c.is_archived = TRUE
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// 5. Archive Staff
router.post('/staff/archive', authenticateToken, isAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    db.run(`UPDATE training_staff SET is_archived = TRUE WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Archived ${this.changes} staff` });
    });
});

// 6. Restore Staff
router.post('/staff/restore', authenticateToken, isAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    db.run(`UPDATE training_staff SET is_archived = FALSE WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Restored ${this.changes} staff` });
    });
});

// 7. Get Archived Staff
router.get('/staff/archived', authenticateToken, isAdmin, (req, res) => {
    const sql = `SELECT * FROM training_staff WHERE is_archived = TRUE`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// --- Purge Archived Records With Retention Window ---
router.post('/purge/archived', authenticateToken, isAdmin, async (req, res) => {
    try {
        const days = Math.max(1, parseInt(req.body.days || 90));
        const dryRun = !!req.body.dry_run;
        const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const result = {};
        // Collect candidates
        const tables = ['cadets', 'users'];
        for (const t of tables) {
            const rows = await new Promise((resolve) => {
                db.all(`SELECT id FROM ${t} WHERE is_archived = TRUE AND created_at < ?`, [cutoffIso], (err, r) => {
                    resolve(err ? [] : r);
                });
            });
            result[t] = rows.map(r => r.id);
        }
        if (dryRun) {
            return res.json({ cutoff: cutoffIso, to_purge: result });
        }
        // Execute hard deletes (bypass safe-delete using marker)
        let total = 0;
        for (const t of tables) {
            const ids = result[t];
            if (ids.length) {
                const placeholders = ids.map(() => '?').join(',');
                await new Promise((resolve, reject) => {
                    db.run(`/* HARD_DELETE */ DELETE FROM ${t} WHERE id IN (${placeholders})`, ids, function(err) {
                        if (err) reject(err);
                        else { total += this.changes || 0; resolve(); }
                    });
                });
            }
        }
        res.json({ cutoff: cutoffIso, purged: result, total });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Save Full Database Backup to server/uploads/backups
router.post('/backup/save', authenticateToken, isAdmin, async (req, res) => {
    try {
        const backup = {
            timestamp: new Date().toISOString(),
            data: {}
        };
        const tables = [
            'cadets', 'users', 'grades', 'activities', 'merit_demerit_logs', 
            'training_days', 'attendance_records', 'training_staff', 'staff_attendance_records',
            'notifications', 'staff_messages'
        ];
        for (const table of tables) {
            backup.data[table] = await new Promise((resolve) => {
                db.all(`SELECT * FROM ${table}`, [], (err, rows) => resolve(err ? [] : rows));
            });
        }
        const serverRoot = path.join(__dirname, '..');
        const backupsDir = path.join(serverRoot, 'uploads', 'backups');
        try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) {}
        const fileName = `rotc-backup-${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(backupsDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8');
        res.json({ message: 'Backup saved', path: `/uploads/backups/${fileName}` });
    } catch (err) {
        console.error("Backup save error:", err);
        res.status(500).json({ message: 'Backup save failed: ' + err.message });
    }
});

module.exports = router;
