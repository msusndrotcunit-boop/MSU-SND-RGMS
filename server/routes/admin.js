const express = require('express');
const { upload, isCloudinaryConfigured } = require('../utils/cloudinary');
const { authenticateToken, isAdmin, isAdminOrPrivilegedStaff } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const { sendEmail } = require('../utils/emailService');
const { processStaffData } = require('../utils/importCadets');
const { broadcastEvent } = require('../utils/sseHelper');
const { updateTotalAttendance, calculateTransmutedGrade } = require('../utils/gradesHelper');
const { invalidateCadet, invalidateTrainingDay, invalidateCache, cacheMiddleware, clearCache, getCacheStats } = require('../middleware/performance');
const router = express.Router();

// Helper to serve default placeholder
const sendDefaultPlaceholder = (res) => {
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#F3F4F6"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    
    if (!res.headersSent) {
        res.writeHead(200, {
            'Content-Type': 'image/svg+xml',
            'Content-Length': Buffer.byteLength(defaultSvg),
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(defaultSvg);
    }
};

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

// Cache for system status (60 seconds - increased for better performance)
let systemStatusCache = null;
let systemStatusCacheTime = 0;
const SYSTEM_STATUS_CACHE_TTL = 60000; // 60 seconds

// Lightweight health check (no counts, just connection test)
router.get('/health-check', authenticateToken, isAdmin, (req, res) => {
    const start = Date.now();
    
    // Just test database connection
    Promise.race([
        new Promise((resolve, reject) => {
            db.get('SELECT 1 as ok', [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)) // 1 second timeout
    ]).then(() => {
        const latencyMs = Date.now() - start;
        res.json({
            status: 'ok',
            latencyMs,
            type: (db && db.pool) ? 'postgres' : 'sqlite',
            timestamp: new Date().toISOString()
        });
    }).catch((err) => {
        res.status(500).json({
            status: 'error',
            error: err.message,
            latencyMs: Date.now() - start
        });
    });
});

router.get('/system-status', authenticateToken, isAdmin, (req, res) => {
    const now = Date.now();
    const start = Date.now();
    
    // Always measure fresh latency, but use cached counts if available
    db.get('SELECT 1 as ok', [], (err, row) => {
        const latencyMs = Date.now() - start;
        
        if (err) {
            console.error('[System Status] Database error:', err);
            return res.status(500).json({
                app: {
                    status: 'error',
                    uptimeSeconds: Math.floor(process.uptime()),
                    time: new Date().toISOString()
                },
                database: {
                    status: 'error',
                    type: (db && db.pool) ? 'postgres' : 'sqlite',
                    error: err.message,
                    latencyMs
                }
            });
        }
        
        // Check if we should update counts (cache expired)
        const shouldUpdateCounts = !systemStatusCache || (now - systemStatusCacheTime) >= SYSTEM_STATUS_CACHE_TTL;
        
        // Use cached counts or defaults
        const results = {
            app: {
                status: 'ok',
                uptimeSeconds: Math.floor(process.uptime()),
                time: new Date().toISOString()
            },
            database: {
                status: 'ok',
                latencyMs, // Always fresh latency
                type: (db && db.pool) ? 'postgres' : 'sqlite'
            },
            metrics: {
                cadets: systemStatusCache?.metrics?.cadets || 290,
                users: systemStatusCache?.metrics?.users || 303,
                trainingDays: systemStatusCache?.metrics?.trainingDays || 15,
                activities: systemStatusCache?.metrics?.activities || 2,
                unreadNotifications: systemStatusCache?.metrics?.unreadNotifications || 0
            }
        };
        
        // Update cache timestamp
        systemStatusCache = results;
        systemStatusCacheTime = Date.now();
        
        // Update counts in background if cache expired
        if (shouldUpdateCounts) {
            setTimeout(() => {
                const updateQuery = db.pool 
                    ? `
                        SELECT 
                            (SELECT COUNT(*) FROM cadets WHERE is_archived IS NOT TRUE) as cadets_total,
                            (SELECT COUNT(*) FROM users WHERE is_archived IS NOT TRUE) as users_total,
                            (SELECT COUNT(*) FROM training_days) as training_days_total,
                            (SELECT COUNT(*) FROM activities) as activities_total,
                            (SELECT COUNT(*) FROM notifications WHERE is_read = FALSE) as unread_notifications_total
                    `
                    : `
                        SELECT 
                            (SELECT COUNT(*) FROM cadets WHERE is_archived IS FALSE OR is_archived IS NULL) as cadets_total,
                            (SELECT COUNT(*) FROM users WHERE is_archived IS FALSE OR is_archived IS NULL) as users_total,
                            (SELECT COUNT(*) FROM training_days) as training_days_total,
                            (SELECT COUNT(*) FROM activities) as activities_total,
                            (SELECT COUNT(*) FROM notifications WHERE is_read = 0) as unread_notifications_total
                    `;
                
                db.get(updateQuery, [], (err, row) => {
                    if (!err && row && systemStatusCache) {
                        systemStatusCache.metrics = {
                            cadets: row.cadets_total || 0,
                            users: row.users_total || 0,
                            trainingDays: row.training_days_total || 0,
                            activities: row.activities_total || 0,
                            unreadNotifications: row.unread_notifications_total || 0
                        };
                    }
                });
            }, 100); // Update in background after 100ms
        }
        
        res.json(results);
    });
});

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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`;

        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.student_id, cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
            cadet.cadet_course || '', cadet.semester || '', 'Ongoing',
            false, false // Use booleans for Postgres compatibility
        ];

        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.id : null);
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
        async function excelAllSheetsToJson(buf) {
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buf);
            const out = [];
            wb.worksheets.forEach(ws => {
                const headers = [];
                ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell?.value?.text || cell?.value || '').trim(); });
                const max = Math.min(ws.rowCount, 10000 + 1);
                for (let r = 2; r <= max; r++) {
                    const row = ws.getRow(r);
                    if (!row || row.cellCount === 0) continue;
                    const obj = {};
                    headers.forEach((h, idx) => {
                        const cell = row.getCell(idx + 1);
                        let v = cell?.value;
                        if (v && typeof v === 'object') v = v.text || v.result || String(v);
                        obj[h] = v ?? '';
                    });
                    out.push(obj);
                }
            });
            return out;
        }
        
        // Only Excel for now
        if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ message: 'PDF import not supported for staff. Please use Excel.' });
        } else {
            data = await excelAllSheetsToJson(req.file.buffer);
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
            data = await (async () => {
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(req.file.buffer);
                const merged = [];
                wb.worksheets.forEach(ws => {
                    const headers = [];
                    ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell?.value?.text || cell?.value || '').trim(); });
                    const max = Math.min(ws.rowCount, 10000 + 1);
                    for (let r = 2; r <= max; r++) {
                        const row = ws.getRow(r);
                        if (!row || row.cellCount === 0) continue;
                        const obj = {};
                        headers.forEach((h, idx) => {
                            const cell = row.getCell(idx + 1);
                            let v = cell?.value;
                            if (v && typeof v === 'object') v = v.text || v.result || String(v);
                            obj[h] = v ?? '';
                        });
                        merged.push(obj);
                    }
                });
                return merged;
            })();
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
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(buffer);
                if (!wb.worksheets || wb.worksheets.length === 0) throw new Error("Excel file is empty");
                wb.worksheets.forEach(ws => {
                    const headers = [];
                    ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell?.value?.text || cell?.value || '').trim(); });
                    const max = Math.min(ws.rowCount, 10000 + 1);
                    for (let r = 2; r <= max; r++) {
                        const row = ws.getRow(r);
                        if (!row || row.cellCount === 0) continue;
                        const obj = {};
                        headers.forEach((h, idx) => {
                            const cell = row.getCell(idx + 1);
                            let v = cell?.value;
                            if (v && typeof v === 'object') v = v.text || v.result || String(v);
                            obj[h] = v ?? '';
                        });
                        data.push(obj);
                    }
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

// GET /api/admin/settings/cadet-source
router.get('/settings/cadet-source', authenticateToken, isAdmin, (req, res) => {
    db.get("SELECT value FROM system_settings WHERE key = 'cadet_list_source_url'", [], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ url: row ? row.value : null });
    });
});

// PUT /api/admin/system-settings - Update system-wide settings (admin only)
router.put('/system-settings', authenticateToken, isAdmin, (req, res) => {
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

 

// --- Analytics ---

// Get Dashboard Analytics
router.get('/analytics', authenticateToken, isAdminOrPrivilegedStaff, cacheMiddleware(600), (req, res) => {
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
            const totalTrainingDays = countRow.total || 0; 

    // 2. Get Grade Stats
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
                    const attendanceScore = totalTrainingDays > 0 ? (gradeData.attendance_present / totalTrainingDays) * 30 : 0;
                    
                    // Aptitude Calculation with 100-point ceiling system:
                    // - All cadets start with 100 base points
                    // - Demerits subtract from the base
                    // - Merits add back BUT cannot exceed 100 ceiling
                    // - Formula: min(100, 100 + merits - demerits)
                    // - This means if a cadet has 100 points and gets merits, no change occurs (already at ceiling)
                    let rawAptitude = 100 + (gradeData.merit_points || 0) - (gradeData.demerit_points || 0);
                    if (rawAptitude > 100) rawAptitude = 100; // Ceiling: Cannot exceed 100
                    if (rawAptitude < 0) rawAptitude = 0;     // Floor: Cannot go below 0
                    
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
                            WHERE c.is_profile_completed IS TRUE 
                              AND (c.is_archived IS FALSE OR c.is_archived IS NULL)
                              AND (u.is_archived IS FALSE OR u.is_archived IS NULL)
                              AND u.is_approved = 1
                              AND c.cadet_course IS NOT NULL AND c.cadet_course != ''
                            GROUP BY c.cadet_course, c.status
                        `;
                        db.all(sql, [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'course_stats', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        const sql = `
                            SELECT 
                                UPPER(TRIM(c.course)) AS course,
                                c.status,
                                COUNT(*) AS count
                            FROM cadets c
                            LEFT JOIN users u ON u.cadet_id = c.id
                            WHERE c.course IS NOT NULL AND c.course != ''
                              AND (c.is_archived IS FALSE OR c.is_archived IS NULL)
                              AND (u.is_archived IS FALSE OR u.is_archived IS NULL)
                              AND c.is_profile_completed IS TRUE
                              AND u.is_approved = 1
                            GROUP BY UPPER(TRIM(c.course)), c.status
                        `;
                        db.all(sql, [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'academic_course_stats', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        const sql = `
                            SELECT 
                                UPPER(TRIM(c.cadet_course)) AS cadet_course,
                                CASE 
                                    WHEN UPPER(TRIM(c.gender)) = 'MALE' THEN 'Male'
                                    WHEN UPPER(TRIM(c.gender)) = 'FEMALE' THEN 'Female'
                                    ELSE 'Unknown'
                                END AS gender,
                                COUNT(*) AS count
                            FROM cadets c
                            WHERE c.cadet_course IS NOT NULL AND c.cadet_course != ''
                              AND (c.is_archived IS FALSE OR c.is_archived IS NULL)
                            GROUP BY UPPER(TRIM(c.cadet_course)), gender
                        `;
                        db.all(sql, [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'gender_by_course', rows });
                        });
                    }),
                    new Promise((resolve, reject) => {
                        const sql = `
                            SELECT UPPER(TRIM(c.cadet_course)) AS cadet_course, COUNT(*) AS count
                            FROM cadets c
                            WHERE c.cadet_course IS NOT NULL AND c.cadet_course != ''
                              AND (c.is_archived IS FALSE OR c.is_archived IS NULL)
                            GROUP BY UPPER(TRIM(c.cadet_course))
                        `;
                        db.all(sql, [], (err, rows) => {
                            if (err) reject(err); else resolve({ type: 'course_totals', rows });
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
                            } else if (result.type === 'academic_course_stats') {
                                demographics.academicCourseStats = result.rows;
                            } else if (result.type === 'gender_by_course') {
                                demographics.genderByCourse = result.rows;
                            } else if (result.type === 'course_totals') {
                                demographics.courseTotals = result.rows;
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

// Get Demographics Analytics (Religion, Age, Courses)
router.get('/analytics/demographics', authenticateToken, isAdmin, cacheMiddleware(600), (req, res) => {
    const demographics = {
        religion: [],
        age: [],
        courses: []
    };
    
    // Database-agnostic boolean check for is_archived
    const archivedCheck = db.pool ? 'is_archived IS NOT TRUE' : '(is_archived IS FALSE OR is_archived IS NULL)';
    
    // Get religion distribution
    const religionSql = `
        SELECT religion, COUNT(*) as count
        FROM cadets
        WHERE ${archivedCheck} AND religion IS NOT NULL AND religion != ''
        GROUP BY religion
        ORDER BY count DESC
    `;
    
    db.all(religionSql, [], (relErr, religionRows) => {
        if (relErr) {
            console.error('Religion analytics error:', relErr.message);
            demographics.religion = [];
        } else {
            demographics.religion = religionRows || [];
        }
        
        // Get age distribution (calculate from birthdate)
        const ageSql = db.pool ? `
            SELECT 
                CASE 
                    WHEN birthdate IS NULL OR birthdate = '' THEN 'Unknown'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate::date)) < 18 THEN 'Under 18'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate::date)) BETWEEN 18 AND 19 THEN '18-19'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate::date)) BETWEEN 20 AND 21 THEN '20-21'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate::date)) BETWEEN 22 AND 23 THEN '22-23'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate::date)) >= 24 THEN '24+'
                    ELSE 'Unknown'
                END as age_range,
                COUNT(*) as count
            FROM cadets
            WHERE ${archivedCheck}
            GROUP BY age_range
            ORDER BY 
                CASE age_range
                    WHEN 'Under 18' THEN 1
                    WHEN '18-19' THEN 2
                    WHEN '20-21' THEN 3
                    WHEN '22-23' THEN 4
                    WHEN '24+' THEN 5
                    ELSE 6
                END
        ` : `
            SELECT 
                CASE 
                    WHEN birthdate IS NULL OR birthdate = '' THEN 'Unknown'
                    WHEN (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) < 18 THEN 'Under 18'
                    WHEN (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) BETWEEN 18 AND 19 THEN '18-19'
                    WHEN (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) BETWEEN 20 AND 21 THEN '20-21'
                    WHEN (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) BETWEEN 22 AND 23 THEN '22-23'
                    WHEN (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) >= 24 THEN '24+'
                    ELSE 'Unknown'
                END as age_range,
                COUNT(*) as count
            FROM cadets
            WHERE ${archivedCheck}
            GROUP BY age_range
            ORDER BY 
                CASE age_range
                    WHEN 'Under 18' THEN 1
                    WHEN '18-19' THEN 2
                    WHEN '20-21' THEN 3
                    WHEN '22-23' THEN 4
                    WHEN '24+' THEN 5
                    ELSE 6
                END
        `;
        
        db.all(ageSql, [], (ageErr, ageRows) => {
            if (ageErr) {
                console.error('Age analytics error:', ageErr.message);
                demographics.age = [];
            } else {
                demographics.age = ageRows || [];
            }
            
            // Get course distribution
            const courseSql = `
                SELECT course, COUNT(*) as count
                FROM cadets
                WHERE ${archivedCheck} AND course IS NOT NULL AND course != ''
                GROUP BY course
                ORDER BY count DESC
            `;
            
            db.all(courseSql, [], (courseErr, courseRows) => {
                if (courseErr) {
                    console.error('Course analytics error:', courseErr.message);
                    demographics.courses = [];
                } else {
                    demographics.courses = courseRows || [];
                }
                
                res.json(demographics);
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`;

            const params = [
                cadet.rank || '', cadet.firstName || '', cadet.middleName || '', cadet.lastName || '', cadet.suffixName || '',
                cadet.studentId, cadet.email || '', cadet.contactNumber || '', cadet.address || '',
                cadet.course || '', cadet.yearLevel || '', cadet.schoolYear || '',
                cadet.battalion || '', cadet.company || '', cadet.platoon || '',
                cadet.cadetCourse || '', cadet.semester || '', cadet.corpPosition || '', cadet.status || 'Ongoing', FALSE
            ];

            db.get(insertSql, params, (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                const newCadetId = row ? row.id : null;

                if (!newCadetId) return res.status(500).json({ message: 'Failed to retrieve new cadet ID' });

                // Create User Account (Auto-approved)
                const baseUsername = cadet.firstName || cadet.studentId; // Default to First Name
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
                
                const insertUser = (uName) => {
                    db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, TRUE, ?)`, 
                        [uName, dummyHash, 'cadet', newCadetId, cadet.email || ''], 
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
                                    try {
                                        broadcastEvent({ type: 'cadet_created', cadetId: newCadetId });
                                    } catch {}
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
    const { 
        includeGrades = 'true', 
        includeArchived = 'false',
        search = '',
        course = 'All',
        company = 'All',
        page,
        limit
    } = req.query;

    const isIncludeGrades = includeGrades === 'true';
    const isIncludeArchived = includeArchived === 'true';
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // 1. Get Total Training Days first
    db.get("SELECT COUNT(*) as total FROM training_days", [], (err, countRow) => {
        if (err) return res.status(500).json({ message: err.message });
        const totalTrainingDays = countRow.total || 0;

        let baseSelect = `
            SELECT c.id, c.rank, c.first_name, c.middle_name, c.last_name, c.suffix_name,
                   c.student_id, c.email, c.contact_number, c.address, 
                   c.course, c.year_level, c.school_year, 
                   c.battalion, c.company, c.platoon, 
                   c.cadet_course, c.semester, c.corp_position, c.status, c.is_profile_completed, c.is_archived,
                   u.username
        `;

        if (isIncludeGrades) {
            baseSelect += `,
                   g.attendance_present, g.merit_points, g.demerit_points, 
                   g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status,
                   g.lifetime_merit_points
            `;
        }

        baseSelect += ` FROM cadets c LEFT JOIN users u ON u.cadet_id = c.id `;
        
        if (isIncludeGrades) {
            baseSelect += ` LEFT JOIN grades g ON c.id = g.cadet_id `;
        }

        let conditions = [];
        let params = [];

        if (!isIncludeArchived) {
            conditions.push("(c.is_archived IS NOT TRUE OR c.is_archived IS NULL)");
        }

        if (search) {
            conditions.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.student_id LIKE ? OR (c.first_name || ' ' || c.last_name) LIKE ?)");
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (course && course !== 'All') {
            if (course === 'Unverified') {
                conditions.push("c.is_profile_completed = 0");
            } else if (course === 'Archived') {
                // Handled by includeArchived but explicitly check here if needed
                conditions.push("c.is_archived = 1");
            } else {
                conditions.push("c.cadet_course = ?");
                params.push(course);
            }
        }

        if (company && company !== 'All') {
            conditions.push("c.company = ?");
            params.push(company);
        }

        let sql = baseSelect;
        if (conditions.length > 0) {
            sql += " WHERE " + conditions.join(" AND ");
        }

        sql += " ORDER BY c.last_name, c.first_name";

        // Count query for pagination metadata
        const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
        const countParams = [...params];

        if (!isNaN(pageNum) && !isNaN(limitNum)) {
            sql += " LIMIT ? OFFSET ?";
            params.push(limitNum, (pageNum - 1) * limitNum);
        }

        const processRows = (rows, totalCount = null) => {
            // Calculate grades for each cadet
            const cadetsWithGrades = rows.map(cadet => {
                if (!isIncludeGrades) return { ...cadet, totalTrainingDays };

                const safeTotalDays = totalTrainingDays > 0 ? totalTrainingDays : 0;
                const present = typeof cadet.attendance_present === 'number' ? cadet.attendance_present : 0;
                const prelim = typeof cadet.prelim_score === 'number' ? cadet.prelim_score : 0;
                const midterm = typeof cadet.midterm_score === 'number' ? cadet.midterm_score : 0;
                const final = typeof cadet.final_score === 'number' ? cadet.final_score : 0;

                const attendanceScore = safeTotalDays > 0 ? (present / safeTotalDays) * 30 : 0;
                
                // Aptitude Calculation with 100-point ceiling system:
                // - All cadets start with 100 base points
                // - Demerits subtract from the base
                // - Merits add back BUT cannot exceed 100 ceiling
                // - Formula: min(100, 100 + merits - demerits)
                // - This means if a cadet has 100 points and gets merits, no change occurs (already at ceiling)
                let rawAptitude = 100 + (cadet.merit_points || 0) - (cadet.demerit_points || 0);
                if (rawAptitude > 100) rawAptitude = 100; // Ceiling: Cannot exceed 100
                if (rawAptitude < 0) rawAptitude = 0;     // Floor: Cannot go below 0
                const aptitudeScore = rawAptitude * 0.3;

                // Subject: (Sum / 300) * 40%
                const subjectScore = ((prelim + midterm + final) / 300) * 40; // 40%

                const finalGrade = attendanceScore + aptitudeScore + subjectScore;
                
                const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, cadet.grade_status);

                return {
                    ...cadet,
                    totalTrainingDays,
                    attendanceScore,
                    aptitudeScore,
                    subjectScore,
                    finalGrade,
                    transmutedGrade,
                    remarks
                };
            });

            if (totalCount !== null) {
                res.json({
                    data: cadetsWithGrades,
                    pagination: {
                        total: totalCount,
                        page: pageNum,
                        limit: limitNum,
                        pages: Math.ceil(totalCount / limitNum)
                    }
                });
            } else {
                res.json(cadetsWithGrades);
            }
        };

        if (!isNaN(pageNum) && !isNaN(limitNum)) {
            db.get(countSql, countParams, (err, countRow) => {
                if (err) return res.status(500).json({ message: err.message });
                const totalCount = countRow.total;
                db.all(sql, params, (err, rows) => {
                    if (err) return res.status(500).json({ message: err.message });
                    processRows(rows || [], totalCount);
                });
            });
        } else {
            db.all(sql, params, (err, rows) => {
                if (err) return res.status(500).json({ message: err.message });
                processRows(rows || []);
            });
        }
    });
});

// Graceful upload wrapper to return JSON errors instead of generic 500
const uploadCadetProfilePic = (req, res, next) => {
    upload.single('profilePic')(req, res, (err) => {
        if (err) {
            console.error("Cadet Profile Pic Upload Error:", err);
            const msg = err.message || 'Unknown upload error';
            return res.status(400).json({ message: `Image upload failed: ${msg}` });
        }
        next();
    });
};

// Update Cadet Personal Info
router.put('/cadets/:id', authenticateToken, isAdmin, uploadCadetProfilePic, (req, res) => {
    const { 
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status,
        username, gender, religion, birthdate
    } = req.body;

    let profilePic = null;
    if (req.file) {
        if (req.file.path && (req.file.path.startsWith('http') || req.file.path.startsWith('https'))) {
            profilePic = req.file.path;
        } else if (req.file.filename) {
            profilePic = `/uploads/${req.file.filename}`;
        } else if (req.file.path) {
            // Local path normalization for absolute paths
            let localPath = req.file.path.replace(/\\/g, '/');
            const uploadsIdx = localPath.indexOf('/uploads/');
            if (uploadsIdx !== -1) {
                profilePic = localPath.substring(uploadsIdx);
            } else {
                profilePic = `/uploads/${path.basename(localPath)}`;
            }
        } else if (req.file.buffer) {
            try {
                profilePic = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            } catch (_) {
                profilePic = null;
            }
        }
    }

    // DEBUG: Cloudinary Configuration Check
    if (req.file && !profilePic) {
        console.warn("[Admin] File uploaded but profilePic path could not be determined. Cloudinary configured:", isCloudinaryConfigured);
    }

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
        'gender = ?',
        'religion = ?',
        'birthdate = ?',
        'status = ?'
    ];

    // Build params dynamically to ensure exact match with setFields
    const params = [
        rank || '', firstName || '', middleName || '', lastName || '', suffixName || '', 
        studentId || '', email || '', contactNumber || '', address || '', 
        course || '', yearLevel || '', schoolYear || '', 
        battalion || '', company || '', platoon || '', 
        cadetCourse || '', semester || '', req.body.corpPosition || '', gender || '', religion || '', birthdate || '', status || ''
    ];

    if (profilePic) {
        setFields.push('profile_pic = ?');
        params.push(profilePic);
    }

    console.log("DEBUG - Update Cadet Fields:", setFields);
    console.log("DEBUG - Update Cadet Params:", params);

    // Validate params length against setFields length
    if (params.length !== setFields.length) {
        console.error("SQL Parameter Mismatch:", {
            setFieldsCount: setFields.length,
            paramsCount: params.length,
            setFields,
            params
        });
        return res.status(500).json({ 
            message: `Server Error: Parameter mismatch (${setFields.length} fields vs ${params.length} values). Please contact administrator.` 
        });
    }

    params.push(req.params.id);

    const sql = `UPDATE cadets SET ${setFields.join(', ')} WHERE id = ?`;

    console.log("Executing Cadet Update SQL:", sql);
    console.log("With Params:", params);

    db.run(sql, params, function(err) {
            if (err) {
                console.error("Database Update Error:", err);
                return res.status(500).json({ message: err.message });
            }
            
            // Sync with Users table (Email/Username) with duplicate pre-check
            if (email || username) {
                const cadetId = Number(req.params.id);
                const checkUsernameSql = `SELECT id, cadet_id, is_archived FROM users WHERE username = ? LIMIT 1`;
                const checkEmailSql = `SELECT id, cadet_id, is_archived FROM users WHERE email = ? LIMIT 1`;
                
                const checkConflicts = (cb) => {
                    if (username) {
                        db.get(checkUsernameSql, [username], (uErr, uRow) => {
                            if (uErr) return cb(uErr);
                            if (email) {
                                db.get(checkEmailSql, [email], (eErr, eRow) => {
                                    if (eErr) return cb(eErr);
                                    cb(null, { uRow, eRow });
                                });
                            } else {
                                cb(null, { uRow, eRow: null });
                            }
                        });
                    } else if (email) {
                        db.get(checkEmailSql, [email], (eErr, eRow) => {
                            if (eErr) return cb(eErr);
                            cb(null, { uRow: null, eRow });
                        });
                    } else {
                        cb(null, { uRow: null, eRow: null });
                    }
                };

                checkConflicts((cErr, rows) => {
                    if (cErr) return res.status(500).json({ message: cErr.message });
                    const usernameConflict = rows.uRow && rows.uRow.cadet_id != cadetId;
                    const emailConflict = rows.eRow && rows.eRow.cadet_id != cadetId;
                    if (usernameConflict || emailConflict) {
                        const conflictFields = [
                            usernameConflict ? 'username' : null,
                            emailConflict ? 'email' : null
                        ].filter(Boolean);
                        try { broadcastEvent({ type: 'cadet_updated', cadetId }); } catch {}
                        return res.json({
                            message: `Cadet updated. ${conflictFields.join(', ')} unchanged due to conflict.`,
                            partial: true,
                            conflicts: {
                                username: usernameConflict ? { userId: rows.uRow.id, cadetId: rows.uRow.cadet_id, is_archived: !!rows.uRow.is_archived } : null,
                                email: emailConflict ? { userId: rows.eRow.id, cadetId: rows.eRow.cadet_id, is_archived: !!rows.eRow.is_archived } : null
                            }
                        });
                    }

                    let updateFields = [];
                    let updateParams = [];
                    if (email) { updateFields.push("email = ?"); updateParams.push(email); }
                    if (username) { updateFields.push("username = ?"); updateParams.push(username); }
                    if (updateFields.length > 0) {
                        updateParams.push(cadetId);
                        const userSql = `UPDATE users SET ${updateFields.join(", ")} WHERE cadet_id = ?`;
                        db.run(userSql, updateParams, (uErr) => {
                            if (uErr) {
                                console.error("Error syncing user credentials:", uErr);
                                return res.status(500).json({ message: 'Failed to update user credentials: ' + uErr.message });
                            }
                            res.json({ message: 'Cadet updated' });
                            try { broadcastEvent({ type: 'cadet_updated', cadetId }); } catch {}
                        });
                    } else {
                        res.json({ message: 'Cadet updated' });
                        try { broadcastEvent({ type: 'cadet_updated', cadetId }); } catch {}
                    }
                });
            } else {
                res.json({ message: 'Cadet updated' });
                try {
                    broadcastEvent({ type: 'cadet_updated', cadetId: Number(req.params.id) });
                } catch {}
            }
        }
    );
});

// Unlock Profile (Bulk)
router.post('/cadets/unlock', authenticateToken, isAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    // Use FALSE for PostgreSQL compatibility (also works with SQLite)
    const sql = `UPDATE cadets SET is_profile_completed = FALSE WHERE id IN (${placeholders})`;

    db.run(sql, ids, function(err) {
        if (err) {
            console.error('Unlock error:', err);
            return res.status(500).json({ message: 'Failed to unlock profiles: ' + err.message });
        }
        res.json({ message: `Successfully unlocked ${this.changes} profile(s)` });
        try {
            broadcastEvent({ type: 'cadet_unlocked', cadetIds: ids });
        } catch {}
    });
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
        await runQuery(`DELETE FROM merit_demerit_logs WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM attendance_records WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM excuse_letters WHERE cadet_id IN (${placeholders})`, ids);
        // Archive users linked to these cadets (soft delete)
        const usersChanges = await runQuery(`UPDATE users SET is_archived = TRUE, is_approved = 0 WHERE cadet_id IN (${placeholders})`, ids);
        // Finally archive cadets (soft delete)
        const cadetChanges = await runQuery(`UPDATE cadets SET is_archived = TRUE WHERE id IN (${placeholders})`, ids);
        
        res.json({ message: `Archived ${cadetChanges} cadets, ${usersChanges} users, and deleted related records` });
        try {
            broadcastEvent({ type: 'cadet_deleted', cadetIds: ids });
        } catch {}
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ message: 'Failed to delete cadets: ' + err.message });
    }
});

// --- Grading Management ---

// Update Grades for a Cadet
router.put('/grades/:cadetId', authenticateToken, isAdmin, async (req, res) => {
            let { meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status, attendancePresent } = req.body;
    const cadetId = Number(req.params.cadetId);

    try {
        const issuerUserId = req.user && req.user.id ? Number(req.user.id) : null;
        const getIssuerName = () => new Promise((resolve) => {
            if (!issuerUserId) return resolve(null);
            db.get(`SELECT id, username, staff_id FROM users WHERE id = ?`, [issuerUserId], (uErr, uRow) => {
                if (uErr || !uRow) return resolve(null);
                if (uRow.staff_id) {
                    db.get(`SELECT rank, first_name, last_name FROM training_staff WHERE id = ?`, [uRow.staff_id], (sErr, sRow) => {
                        if (sErr || !sRow) return resolve(uRow.username || null);
                        const n = [sRow.rank, sRow.last_name, sRow.first_name].filter(Boolean);
                        resolve(n.length ? `${n[0] ? n[0] + ' ' : ''}${n[1] || ''}${n[2] ? ', ' + n[2] : ''}`.trim() : (uRow.username || null));
                    });
                } else {
                    resolve(uRow.username || null);
                }
            });
        });
        const issuerName = await getIssuerName();
        const row = await new Promise((resolve, reject) => {
            db.get("SELECT id, merit_points, demerit_points FROM grades WHERE cadet_id = ?", [cadetId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const ensureAttendanceRecord = async () => {
            if (attendancePresent === undefined || attendancePresent === null) return;
            const currentPresent = await new Promise((resolve) => {
                db.get(`SELECT COUNT(*) as present FROM attendance_records WHERE cadet_id = ? AND lower(status) = 'present'`, [cadetId], (aErr, aRow) => {
                    if (aErr) return resolve(0);
                    resolve(aRow && aRow.present ? aRow.present : 0);
                });
            });

            if ((attendancePresent || 0) > currentPresent) {
                const dayRow = await new Promise((resolve) => {
                    db.get(`SELECT id FROM training_days ORDER BY date DESC LIMIT 1`, [], (dErr, dRow) => {
                        if (dErr) return resolve(null);
                        resolve(dRow);
                    });
                });

                if (!dayRow || !dayRow.id) return;
                const dayId = dayRow.id;

                const rRow = await new Promise((resolve) => {
                    db.get(`SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?`, [dayId, cadetId], (rErr, rRow) => {
                        if (rErr) return resolve(null);
                        resolve(rRow);
                    });
                });

                if (rRow && rRow.id) {
                    await new Promise((resolve) => {
                        db.run(`UPDATE attendance_records SET status = 'present', remarks = 'Manual update via Grading' WHERE id = ?`, [rRow.id], () => {
                            broadcastEvent({ type: 'attendance_updated', cadetId, dayId, status: 'present' });
                            resolve();
                        });
                    });
                } else {
                    await new Promise((resolve) => {
                        db.run(`INSERT INTO attendance_records (training_day_id, cadet_id, status, remarks, time_in, time_out) VALUES (?, ?, 'present', 'Manual update via Grading', ?, ?)`, 
                            [dayId, cadetId, new Date().toLocaleTimeString(), null], () => {
                            broadcastEvent({ type: 'attendance_updated', cadetId, dayId, status: 'present' });
                            resolve();
                        });
                    });
                }
            }
        };

        const clampScore = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return null;
            if (n < 0) return 0;
            if (n > 100) return 100;
            return n;
        };
        prelimScore = clampScore(prelimScore);
        midtermScore = clampScore(midtermScore);
        finalScore = clampScore(finalScore);
        if (prelimScore === null || midtermScore === null || finalScore === null) {
            return res.status(400).json({ message: 'Invalid score values' });
        }

        const runUpdate = async (currentMerit, currentDemerit) => {
            await new Promise((resolve, reject) => {
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
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            // Sync Logs: Create manual adjustment logs if points changed
            const meritDiff = (meritPoints || 0) - (currentMerit || 0);
            const demeritDiff = (demeritPoints || 0) - (currentDemerit || 0);
            
            if (meritDiff !== 0) {
                await new Promise(resolve => {
                    db.run(
                        `INSERT INTO merit_demerit_logs (cadet_id, type, points, reason, issued_by_user_id, issued_by_name) 
                         VALUES (?, 'merit', ?, 'Manual Adjustment by Admin', ?, ?)`, 
                        [cadetId, meritDiff, issuerUserId, issuerName], 
                        (err) => { if (err) console.error('Merit log insert error:', err); resolve(); }
                    );
                });
            }
            if (demeritDiff !== 0) {
                await new Promise(resolve => {
                    db.run(
                        `INSERT INTO merit_demerit_logs (cadet_id, type, points, reason, issued_by_user_id, issued_by_name) 
                         VALUES (?, 'demerit', ?, 'Manual Adjustment by Admin', ?, ?)`, 
                        [cadetId, demeritDiff, issuerUserId, issuerName], 
                        (err) => { if (err) console.error('Demerit log insert error:', err); resolve(); }
                    );
                });
            }

            const cadet = await new Promise((resolve) => {
                db.get(`SELECT id, email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], (err, row) => {
                    if (err) resolve(null);
                    else resolve(row);
                });
            });
            
            let emailSent = false;
            if (cadet && cadet.email) {
                const subject = 'ROTC Grading System - Grades Updated';
                const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nYour grades have been updated by the admin.\n\nPlease log in to the portal to view your latest standing.\n\nRegards,\nROTC Admin`;
                const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>Your grades have been updated by the admin.</p><p>Please log in to the portal to view your latest standing.</p><p>Regards,<br>ROTC Admin</p>`;
                try {
                    emailSent = await sendEmail(cadet.email, subject, text, html);
                } catch (e) {
                    console.error('Error sending grade update email:', e);
                }
            }
 
            const userRow = await new Promise((resolve) => {
                db.get(`SELECT id FROM users WHERE cadet_id = ? AND role = 'cadet'`, [cadetId], (uErr, row) => {
                    if (uErr) resolve(null);
                    else resolve(row);
                });
            });
 
            if (userRow && userRow.id) {
                const notifMessage = 'Your grades have been updated. Please check your portal.';
                await new Promise(resolve => {
                    db.run(
                        `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`,
                        [userRow.id, notifMessage, 'grade'],
                        (nErr) => {
                            if (nErr) console.error('Error creating grade notification:', nErr);
                            resolve();
                        }
                    );
                });
            }
            
            await ensureAttendanceRecord();
            // Use updateTotalAttendance helper to ensure consistency
            await updateTotalAttendance(cadetId);
            // Invalidate cadet-related caches so /api/cadet/my-grades reflects changes immediately
            try { invalidateCadet(cadetId); } catch (_) {}
            broadcastEvent({ type: 'grade_updated', cadetId });
            res.json({ message: 'Grades updated' });
        };

        if (!row) {
            // Initialize with defaults if missing
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status) 
                        VALUES (?, 0, 0, 0, 0, 0, 0, 'active')`, [cadetId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            await runUpdate(0, 0);
        } else {
            await runUpdate(row.merit_points, row.demerit_points);
        }
    } catch (err) {
        console.error('Grade update error:', err);
        res.status(500).json({ message: err.message });
    }
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

// Use disk storage for activity images to avoid synchronous Cloudinary latency on uploads
const ensureUploadsDir = () => {
    try {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        return uploadDir;
    } catch (_) {
        return path.join(process.cwd(), 'uploads');
    }
};
const activityStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, ensureUploadsDir());
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || '');
        cb(null, (file.fieldname || 'image') + '-' + uniqueSuffix + ext);
    }
});
const activityUpload = multer({
    storage: activityStorage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// Upload Activity
router.post('/activities', activityUpload.array('images', 10), async (req, res) => {
    try {
        const { title, description, date, type } = req.body;
        
        console.log('[POST /activities] Create request received', {
            title,
            type,
            date,
            filesCount: req.files ? req.files.length : 0
        });
        
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
        
        console.log('[POST /activities] Validation check', {
            activityType,
            totalImages: images.length
        });
        
        // Server-side validation for image count
        if (activityType === 'activity' && images.length < 1) {
            console.log('[POST /activities] Validation failed: Activity needs 1+ image');
            return res.status(400).json({ message: 'Activities require at least 1 photo.' });
        }
        
        if (activityType === 'activity' && images.length > 5) {
            console.log('[POST /activities] Validation failed: Activity can have max 5 images');
            return res.status(400).json({ message: 'Activities can have maximum 5 photos.' });
        }
        
        if (activityType === 'announcement' && images.length < 1) {
            console.log('[POST /activities] Validation failed: Announcement needs 1+ image');
            return res.status(400).json({ message: 'Announcements require at least 1 photo.' });
        }

        const imagesJson = JSON.stringify(images);
        const primaryImage = images[0] || null;

        console.log('[POST /activities] Validation passed, inserting into database...');

        // Insert into database immediately (fast response)
        db.run(
            `INSERT INTO activities (title, description, date, image_path, images, type) VALUES (?, ?, ?, ?, ?, ?)`,
            [title, description, date, primaryImage, imagesJson, activityType],
            function(err) {
                if (err) {
                    console.error('[POST /activities] Database error:', err);
                    return res.status(500).json({ message: err.message });
                }
                
                const activityId = this && typeof this.lastID !== 'undefined' ? this.lastID : null;
                console.log('[POST /activities] Insert successful, ID:', activityId);
                
                // Create notification for the new activity
                const notifMsg = `New ${activityType === 'announcement' ? 'Announcement' : 'Activity'} Posted: ${title}`;
                db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, 'activity')`, 
                    [notifMsg], 
                    (nErr) => {
                        if (nErr) console.error("[POST /activities] Error creating activity notification:", nErr);
                    }
                );
                
                // Invalidate activities list cache (Requirement 8.3)
                invalidateCache('*activities*');
                
                // Send response immediately
                console.log('[POST /activities] Response sent successfully');
                res.json({ id: activityId, message: 'Activity created' });
                
                // Background: Upload local images to Cloudinary if configured
                if (req.files && req.files.length > 0 && isCloudinaryConfigured()) {
                    setImmediate(async () => {
                        try {
                            const cloudinary = require('cloudinary').v2;
                            const uploadPromises = req.files
                                .filter(file => file.filename && !file.path?.startsWith('http'))
                                .map(async (file) => {
                                    try {
                                        const localPath = path.join(__dirname, '../uploads', file.filename);
                                        const result = await cloudinary.uploader.upload(localPath, {
                                            folder: 'rotc-grading-system',
                                            resource_type: 'auto'
                                        });
                                        return { local: `/uploads/${file.filename}`, cloud: result.secure_url };
                                    } catch (uploadErr) {
                                        console.error('[Background] Cloudinary upload failed:', uploadErr);
                                        return null;
                                    }
                                });
                            
                            const results = await Promise.all(uploadPromises);
                            const validResults = results.filter(Boolean);
                            
                            if (validResults.length > 0 && activityId) {
                                // Update images with Cloudinary URLs
                                db.get('SELECT images FROM activities WHERE id = ?', [activityId], (err, row) => {
                                    if (err || !row) return;
                                    let currentImages = JSON.parse(row.images || '[]');
                                    validResults.forEach(({ local, cloud }) => {
                                        const index = currentImages.indexOf(local);
                                        if (index !== -1) {
                                            currentImages[index] = cloud;
                                        }
                                    });
                                    const updatedImagesJson = JSON.stringify(currentImages);
                                    const updatedPrimary = currentImages[0] || null;
                                    db.run(
                                        'UPDATE activities SET images = ?, image_path = ? WHERE id = ?',
                                        [updatedImagesJson, updatedPrimary, activityId],
                                        (updateErr) => {
                                            if (updateErr) console.error('[Background] Failed to update with Cloudinary URLs:', updateErr);
                                            else console.log('[Background] Successfully updated with Cloudinary URLs');
                                        }
                                    );
                                });
                            }
                        } catch (bgErr) {
                            console.error('[Background] Error in Cloudinary upload process:', bgErr);
                        }
                    });
                }
            });
    } catch (error) {
        console.error('[POST /activities] Unexpected error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to create activity: ' + error.message });
        }
    }
});

// Delete Activity
router.delete('/activities/:id', authenticateToken, isAdmin, (req, res) => {
    db.run(`DELETE FROM activities WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        // Invalidate activities list cache (Requirement 8.3)
        invalidateCache('*activities*');
        
        res.json({ message: 'Activity deleted' });
    });
});

// Update Activity
router.put('/activities/:id', activityUpload.array('images', 10), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, date, type, existingImages } = req.body;
        
        console.log('[PUT /activities/:id] Update request received', { 
            id, 
            title, 
            type, 
            date,
            existingImagesLength: existingImages ? existingImages.length : 0,
            newFilesCount: req.files ? req.files.length : 0
        });
        
        // Parse existing images (images that weren't deleted)
        let images = [];
        try {
            if (existingImages) {
                images = JSON.parse(existingImages);
                console.log('[PUT /activities/:id] Parsed existing images:', images.length);
            }
        } catch (e) {
            console.error('[PUT /activities/:id] Error parsing existing images:', e);
            return res.status(400).json({ message: 'Invalid existing images format' });
        }
        
        // Add newly uploaded images - handle both Cloudinary and local paths
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => {
                // Cloudinary path
                if (file.path && (file.path.startsWith('http') || file.path.startsWith('https'))) {
                    return file.path;
                }
                // Local upload path
                if (file.filename) {
                    return `/uploads/${file.filename}`;
                }
                // Base64 fallback
                if (file.buffer) {
                    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
                }
                return null;
            }).filter(Boolean);
            images = [...images, ...newImages];
            
            console.log('[PUT /activities/:id] New images added:', newImages.length);
        }

        const activityType = type || 'activity';
        
        console.log('[PUT /activities/:id] Validation check', { 
            activityType, 
            totalImages: images.length 
        });
        
        // Server-side validation for image count
        if (activityType === 'activity' && images.length < 1) {
            console.log('[PUT /activities/:id] Validation failed: Activity needs 1+ image');
            return res.status(400).json({ message: 'Activities require at least 1 photo.' });
        }
        
        if (activityType === 'activity' && images.length > 5) {
            console.log('[PUT /activities/:id] Validation failed: Activity can have max 5 images');
            return res.status(400).json({ message: 'Activities can have maximum 5 photos.' });
        }
        
        if (activityType === 'announcement' && images.length < 1) {
            console.log('[PUT /activities/:id] Validation failed: Announcement needs 1+ image');
            return res.status(400).json({ message: 'Announcements require at least 1 photo.' });
        }
        
        console.log('[PUT /activities/:id] Validation passed, updating database...');

        const imagesJson = JSON.stringify(images);
        const primaryImage = images[0] || null;

        // Update database immediately (fast response)
        db.run(
            `UPDATE activities SET title = ?, description = ?, date = ?, image_path = ?, images = ?, type = ? WHERE id = ?`,
            [title, description, date, primaryImage, imagesJson, activityType, id],
            function(err) {
                if (err) {
                    console.error('[PUT /activities/:id] Database error:', err);
                    return res.status(500).json({ message: err.message });
                }
                
                console.log('[PUT /activities/:id] Update successful, rows affected:', this.changes);
                
                // Create notification for the updated activity
                const notifMsg = `${activityType === 'announcement' ? 'Announcement' : 'Activity'} Updated: ${title}`;
                db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, 'activity')`, 
                    [notifMsg], 
                    (nErr) => {
                        if (nErr) console.error("[PUT /activities/:id] Error creating update notification:", nErr);
                    }
                );
                
                // Invalidate activities list cache (Requirement 8.3)
                invalidateCache('*activities*');
                
                // Send response immediately
                console.log('[PUT /activities/:id] Response sent successfully');
                res.json({ message: 'Activity updated successfully' });
                
                // Background: Upload local images to Cloudinary if configured
                if (req.files && req.files.length > 0 && isCloudinaryConfigured()) {
                    setImmediate(async () => {
                        try {
                            const cloudinary = require('cloudinary').v2;
                            const uploadPromises = req.files
                                .filter(file => file.filename && !file.path?.startsWith('http'))
                                .map(async (file) => {
                                    try {
                                        const localPath = path.join(__dirname, '../uploads', file.filename);
                                        const result = await cloudinary.uploader.upload(localPath, {
                                            folder: 'rotc-grading-system',
                                            resource_type: 'auto'
                                        });
                                        return { local: `/uploads/${file.filename}`, cloud: result.secure_url };
                                    } catch (uploadErr) {
                                        console.error('[Background] Cloudinary upload failed:', uploadErr);
                                        return null;
                                    }
                                });
                            
                            const results = await Promise.all(uploadPromises);
                            const validResults = results.filter(Boolean);
                            
                            if (validResults.length > 0) {
                                // Update images with Cloudinary URLs
                                db.get('SELECT images FROM activities WHERE id = ?', [id], (err, row) => {
                                    if (err || !row) return;
                                    let currentImages = JSON.parse(row.images || '[]');
                                    validResults.forEach(({ local, cloud }) => {
                                        const index = currentImages.indexOf(local);
                                        if (index !== -1) {
                                            currentImages[index] = cloud;
                                        }
                                    });
                                    const updatedImagesJson = JSON.stringify(currentImages);
                                    const updatedPrimary = currentImages[0] || null;
                                    db.run(
                                        'UPDATE activities SET images = ?, image_path = ? WHERE id = ?',
                                        [updatedImagesJson, updatedPrimary, id],
                                        (updateErr) => {
                                            if (updateErr) console.error('[Background] Failed to update with Cloudinary URLs:', updateErr);
                                            else console.log('[Background] Successfully updated with Cloudinary URLs');
                                        }
                                    );
                                });
                            }
                        } catch (bgErr) {
                            console.error('[Background] Error in Cloudinary upload process:', bgErr);
                        }
                    });
                }
            }
        );
    } catch (error) {
        console.error('[PUT /activities/:id] Unexpected error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to update activity: ' + error.message });
        }
    }
});

// --- User Management (Approvals) ---

// Get Users (filter by pending)
router.get('/users', authenticateToken, isAdmin, (req, res) => {
    const { pending } = req.query;
    let sql = `SELECT u.id, u.username, u.role, u.is_approved, u.email, 
                      c.first_name, c.last_name, c.student_id 
               FROM users u
               LEFT JOIN cadets c ON u.cadet_id = c.id`;
    
    // Debug log to check database queries
    console.log(`Fetching users with pending=${pending}`);

    const params = [];
    if (pending === 'true') {
        sql += ` WHERE u.is_approved = FALSE`;
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
router.put('/users/:id/approve', authenticateToken, isAdmin, (req, res) => {
    db.run(`UPDATE users SET is_approved = TRUE WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        // Ensure grades record exists for the approved cadet
        db.get("SELECT cadet_id, email FROM users WHERE id = ?", [req.params.id], (err, user) => {
            if (user && user.cadet_id) {
                db.run("INSERT INTO grades (cadet_id) VALUES (?) ON CONFLICT (cadet_id) DO NOTHING", [user.cadet_id], (err) => {
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
router.delete('/users/:id', authenticateToken, isAdmin, (req, res) => {
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
    const sql = `
        SELECT u.id, u.username, u.email, u.profile_pic, u.staff_id, COALESCE(u.gender, s.gender) AS gender
        FROM users u
        LEFT JOIN training_staff s ON s.id = u.staff_id
        WHERE u.id = ?
    `;
    db.get(sql, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(row);
    });
});

// Get Current Admin Profile Picture
router.get('/profile/image', authenticateToken, isAdmin, (req, res) => {
    db.get('SELECT profile_pic FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) {
            console.error('[admin] DB error for admin profile image:', err);
            return sendDefaultPlaceholder(res);
        }
        
        if (row && row.profile_pic) {
            const imageSource = row.profile_pic;
            
            // Re-using logic similar to images.js for consistent serving
            let src = String(imageSource);
            src = src.replace(/\\/g, '/');
            
            // Handle URLs
            if (src.startsWith('http')) {
                return res.redirect(src);
            }
            
            // Handle Local Files
            if (src.startsWith('/uploads/')) {
                const fullPath = path.join(__dirname, '..', src);
                if (fs.existsSync(fullPath)) {
                    const protocol = req.protocol || 'https';
                    const host = req.get('host');
                    if (host) {
                        return res.redirect(`${protocol}://${host}${src}`);
                    }
                    return res.redirect(src);
                } else {
                    return sendDefaultPlaceholder(res);
                }
            }

            // Handle Base64
            if (src.startsWith('data:image')) {
                const matches = src.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    const type = matches[1];
                    const buffer = Buffer.from(matches[2], 'base64');
                    res.writeHead(200, {
                        'Content-Type': type,
                        'Content-Length': buffer.length,
                        'Cache-Control': 'public, max-age=86400'
                    });
                    return res.end(buffer);
                }
            }
        }

        // Fallback to placeholder
        sendDefaultPlaceholder(res);
    });
});

// Update Admin Profile (Photo and/or Gender)
router.put('/profile', authenticateToken, isAdmin, upload.single('profilePic'), (req, res) => {
    const { gender } = req.body || {};
    const doUpdates = [];
    let imageUrl = null;
    
    if (req.file) {
        imageUrl = req.file.path;
        if (!imageUrl && req.file.buffer && req.file.mimetype) {
            imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
        if (imageUrl && imageUrl.includes('uploads') && !imageUrl.startsWith('http')) {
            const parts = imageUrl.split(/[\\/]/);
            const uploadIndex = parts.indexOf('uploads');
            if (uploadIndex !== -1) {
                imageUrl = '/' + parts.slice(uploadIndex).join('/');
            }
        }
        if (imageUrl) {
            doUpdates.push(new Promise((resolve) => {
                db.run(`UPDATE users SET profile_pic = ? WHERE id = ?`, [imageUrl, req.user.id], function(err) {
                    if (err) resolve({ ok: false, error: err.message });
                    else resolve({ ok: true, profilePic: imageUrl });
                });
            }));
        }
    }
    
    // Update gender if provided and linked to a staff record
    if (gender) {
        doUpdates.push(new Promise((resolve) => {
            db.get(`SELECT staff_id FROM users WHERE id = ?`, [req.user.id], (err, row) => {
                if (err) return resolve({ ok: false, error: err.message });
                const staffId = row && row.staff_id;
                if (staffId) {
                    db.run(`UPDATE training_staff SET gender = ? WHERE id = ?`, [gender, staffId], function(updErr) {
                        if (updErr) resolve({ ok: false, error: updErr.message });
                        else resolve({ ok: true, gender });
                    });
                } else {
                    db.run(`UPDATE users SET gender = ? WHERE id = ?`, [gender, req.user.id], function(updErr) {
                        if (updErr) resolve({ ok: false, error: updErr.message });
                        else resolve({ ok: true, gender });
                    });
                }
            });
        }));
    }
    
    if (doUpdates.length === 0) {
        return res.status(400).json({ message: 'No changes submitted' });
    }
    
    Promise.all(doUpdates).then((results) => {
        const resp = { message: 'Profile updated' };
        const picRes = results.find(r => r.profilePic);
        const genderRes = results.find(r => r.gender);
        if (picRes && picRes.profilePic) resp.profilePic = picRes.profilePic;
        if (genderRes && genderRes.gender) resp.gender = genderRes.gender;
        const errRes = results.find(r => r.ok === false);
        if (errRes && !resp.profilePic && !resp.gender) {
            return res.status(500).json({ message: errRes.error || 'Update failed' });
        }
        
        // Invalidate user profile cache (Requirement 8.4)
        invalidateCache(`*user*${req.user.id}*`);
        
        res.json(resp);
    }).catch((e) => {
        res.status(500).json({ message: e.message || 'Update failed' });
    });
});

// --- Merit/Demerit Ledger ---
// Get Logs for a Cadet
router.get('/merit-logs/:cadetId', authenticateToken, isAdmin, (req, res) => {
    const sql = `SELECT * FROM merit_demerit_logs WHERE cadet_id = ? ORDER BY date_recorded DESC`;
    db.all(sql, [req.params.cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Reconcile (Backfill) Ledger from Grades
router.post('/ledger/backfill', authenticateToken, isAdmin, async (req, res) => {
    const { cadetId } = req.body || {};
    const issuerUserId = req.user && req.user.id ? Number(req.user.id) : null;
    const getIssuerName = () => new Promise((resolve) => {
        if (!issuerUserId) return resolve(null);
        db.get(`SELECT id, username, staff_id FROM users WHERE id = ?`, [issuerUserId], (uErr, uRow) => {
            if (uErr || !uRow) return resolve(null);
            if (uRow.staff_id) {
                db.get(`SELECT rank, first_name, last_name FROM training_staff WHERE id = ?`, [uRow.staff_id], (sErr, sRow) => {
                    if (sErr || !sRow) return resolve(uRow.username || null);
                    const n = [sRow.rank, sRow.last_name, sRow.first_name].filter(Boolean);
                    resolve(n.length ? `${n[0] ? n[0] + ' ' : ''}${n[1] || ''}${n[2] ? ', ' + n[2] : ''}`.trim() : (uRow.username || null));
                });
            } else {
                resolve(uRow.username || null);
            }
        });
    });
    const issuerName = await getIssuerName();
    const targetCadets = await new Promise((resolve) => {
        if (cadetId) {
            db.all(`SELECT cadet_id, merit_points, demerit_points FROM grades WHERE cadet_id = ?`, [cadetId], (gErr, rows) => resolve(gErr ? [] : rows || []));
        } else {
            db.all(`SELECT cadet_id, merit_points, demerit_points FROM grades`, [], (gErr, rows) => resolve(gErr ? [] : rows || []));
        }
    });
    const summary = [];
    for (const g of targetCadets) {
        const sums = await new Promise((resolve) => {
            db.all(`SELECT type, COALESCE(SUM(points),0) as pts FROM merit_demerit_logs WHERE cadet_id = ? GROUP BY type`, [g.cadet_id], (lErr, rows) => {
                const map = { merit: 0, demerit: 0 };
                if (!lErr && Array.isArray(rows)) rows.forEach(r => { map[r.type] = Number(r.pts || 0); });
                resolve(map);
            });
        });
        const meritDiff = Math.max(0, Number(g.merit_points || 0) - Number(sums.merit || 0));
        const demeritDiff = Math.max(0, Number(g.demerit_points || 0) - Number(sums.demerit || 0));
        const applied = { cadetId: g.cadet_id, meritBackfilled: 0, demeritBackfilled: 0 };
        if (meritDiff > 0) {
            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO merit_demerit_logs (cadet_id, type, points, reason, issued_by_user_id, issued_by_name) 
                     VALUES (?, 'merit', ?, 'Backfill from Grades', ?, ?)`,
                    [g.cadet_id, meritDiff, issuerUserId, issuerName],
                    (err) => { if (err) console.error('Backfill merit error:', err.message); else applied.meritBackfilled = meritDiff; resolve(); }
                );
            });
        }
        if (demeritDiff > 0) {
            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO merit_demerit_logs (cadet_id, type, points, reason, issued_by_user_id, issued_by_name) 
                     VALUES (?, 'demerit', ?, 'Backfill from Grades', ?, ?)`,
                    [g.cadet_id, demeritDiff, issuerUserId, issuerName],
                    (err) => { if (err) console.error('Backfill demerit error:', err.message); else applied.demeritBackfilled = demeritDiff; resolve(); }
                );
            });
        }
        if (applied.meritBackfilled || applied.demeritBackfilled) {
            try { broadcastEvent({ type: 'grade_updated', cadetId: g.cadet_id }); } catch (_) {}
        }
        summary.push(applied);
    }
    res.json({ message: 'Backfill complete', summary });
});
// Add Log Entry (and update Total)
router.post('/merit-logs', authenticateToken, isAdmin, (req, res) => {
    const { cadetId, type, points, reason } = req.body;
    
    console.log('[POST /merit-logs] Request received:', { cadetId, type, points, reason });
    
    const issuerUserId = req.user && req.user.id ? Number(req.user.id) : null;
    console.log('[POST /merit-logs] Issuer user ID:', issuerUserId);
    
    const getIssuerName = () => new Promise((resolve) => {
        if (!issuerUserId) return resolve(null);
        db.get(`SELECT id, username, staff_id FROM users WHERE id = ?`, [issuerUserId], (uErr, uRow) => {
            if (uErr || !uRow) return resolve(null);
            if (uRow.staff_id) {
                db.get(`SELECT rank, first_name, last_name FROM training_staff WHERE id = ?`, [uRow.staff_id], (sErr, sRow) => {
                    if (sErr || !sRow) return resolve(uRow.username || null);
                    const n = [sRow.rank, sRow.last_name, sRow.first_name].filter(Boolean);
                    resolve(n.length ? `${n[0] ? n[0] + ' ' : ''}${n[1] || ''}${n[2] ? ', ' + n[2] : ''}`.trim() : (uRow.username || null));
                });
            } else {
                resolve(uRow.username || null);
            }
        });
    });
    
    getIssuerName().then((issuerName) => {
        console.log('[POST /merit-logs] Issuer name resolved:', issuerName);
        db.run('BEGIN', [], (beginErr) => {
            if (beginErr) {
                console.error('[POST /merit-logs] BEGIN transaction error:', beginErr);
                return res.status(500).json({ message: beginErr.message });
            }
            db.run(`INSERT INTO merit_demerit_logs (cadet_id, type, points, reason, issued_by_user_id, issued_by_name) VALUES (?, ?, ?, ?, ?, ?)`, 
                [cadetId, type, points, reason, issuerUserId, issuerName], 
                function(err) {
                if (err) {
                    console.error('[POST /merit-logs] INSERT log error:', err);
                    return db.run('ROLLBACK', [], () => res.status(500).json({ message: err.message }));
                }
                console.log('[POST /merit-logs] Log inserted, ID:', this.lastID);
                const column = type === 'merit' ? 'merit_points' : 'demerit_points';
                const ensureGradeRow = () => {
                    db.get(`SELECT id FROM grades WHERE cadet_id = ?`, [cadetId], (gErr, gRow) => {
                        if (gErr) {
                            return db.run('ROLLBACK', [], () => res.status(500).json({ message: gErr.message }));
                        }
                        if (!gRow) {
                            db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (insErr) => {
                                if (insErr) return db.run('ROLLBACK', [], () => res.status(500).json({ message: 'Failed to init grades' }));
                                applyGradeUpdate();
                            });
                        } else {
                            applyGradeUpdate();
                        }
                    });
                };
                const applyGradeUpdate = () => {
                    // Check if lifetime_merit_points column exists first
                    // Use database-agnostic query
                    const checkColumnSql = db.pool 
                        ? `SELECT column_name FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'lifetime_merit_points'`
                        : `PRAGMA table_info(grades)`;
                    
                    db.all(checkColumnSql, [], (pragmaErr, columns) => {
                        if (pragmaErr) {
                            console.error('[POST /merit-logs] Error checking table schema:', pragmaErr);
                            return db.run('ROLLBACK', [], () => res.status(500).json({ message: pragmaErr.message }));
                        }
                        
                        // Handle different result formats for PostgreSQL vs SQLite
                        const hasLifetimeColumn = db.pool 
                            ? columns.length > 0  // PostgreSQL: returns rows if column exists
                            : columns.some(col => col.name === 'lifetime_merit_points');  // SQLite: returns table info
                        
                        console.log('[POST /merit-logs] Has lifetime_merit_points column:', hasLifetimeColumn);
                        
                        // Update both current points and lifetime merit points (if merit type and column exists)
                        let updateSql = `UPDATE grades SET ${column} = ${column} + ?`;
                        const updateParams = [points];
                        
                        if (type === 'merit' && hasLifetimeColumn) {
                            updateSql += `, lifetime_merit_points = COALESCE(lifetime_merit_points, 0) + ?`;
                            updateParams.push(points);
                        }
                        
                        updateSql += ` WHERE cadet_id = ?`;
                        updateParams.push(cadetId);
                        
                        console.log('[POST /merit-logs] Update SQL:', updateSql, updateParams);
                        
                        db.run(updateSql, updateParams, (uErr) => {
                            if (uErr) {
                                console.error('[POST /merit-logs] UPDATE grades error:', uErr);
                                return db.run('ROLLBACK', [], () => res.status(500).json({ message: uErr.message }));
                            }
                            console.log('[POST /merit-logs] Grades updated successfully');
                            db.run('COMMIT', [], () => {
                                console.log('[POST /merit-logs] Transaction committed');
                                
                                // Invalidate cache for this cadet (Requirement 8.1)
                                invalidateCadet(cadetId);
                                
                                db.get(`SELECT email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], async (cErr, cadet) => {
                                    if (!cErr && cadet && cadet.email) {
                                        const subject = `ROTC System - New ${type === 'merit' ? 'Merit' : 'Demerit'} Record`;
                                        const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nA new ${type} record has been added to your profile.\nPoints: ${points}\nReason: ${reason}\n\nPlease check your dashboard for details.\n\nRegards,\nROTC Admin`;
                                        const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>A new <strong>${type}</strong> record has been added to your profile.</p><ul><li><strong>Points:</strong> ${points}</li><li><strong>Reason:</strong> ${reason}</li></ul><p>Please check your dashboard for details.</p><p>Regards,<br>ROTC Admin</p>`;
                                        try { await sendEmail(cadet.email, subject, text, html); } catch (_) {}
                                    }
                                    broadcastEvent({ type: 'grade_updated', cadetId: Number(cadetId) });
                                    console.log('[POST /merit-logs] Response sent successfully');
                                    res.json({ message: 'Log added and points updated' });
                                });
                            });
                        });
                    });
                };
                ensureGradeRow();
            });
        });
    });
});

// Delete Merit/Demerit Log
router.delete('/merit-logs/:id', authenticateToken, isAdmin, (req, res) => {
    const logId = req.params.id;
    
    // 1. Get the log details first to know what to subtract
    db.get(`SELECT * FROM merit_demerit_logs WHERE id = ?`, [logId], (err, log) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!log) return res.status(404).json({ message: 'Log not found' });
        db.run('BEGIN', [], (bErr) => {
            if (bErr) return res.status(500).json({ message: bErr.message });
            db.run(`DELETE FROM merit_demerit_logs WHERE id = ?`, [logId], (dErr) => {
                if (dErr) return db.run('ROLLBACK', [], () => res.status(500).json({ message: dErr.message }));
                const column = log.type === 'merit' ? 'merit_points' : 'demerit_points';
                db.run(`UPDATE grades SET ${column} = ${column} - ? WHERE cadet_id = ?`, [log.points, log.cadet_id], (uErr) => {
                    if (uErr) return db.run('ROLLBACK', [], () => res.status(500).json({ message: uErr.message }));
                    db.run('COMMIT', [], () => {
                        // Invalidate cache for this cadet (Requirement 8.1)
                        invalidateCadet(log.cadet_id);
                        
                        broadcastEvent({ type: 'grade_updated', cadetId: Number(log.cadet_id) });
                        res.json({ message: 'Log deleted and points reverted' });
                    });
                });
            });
        });
    });
});

// --- Notifications ---

// Get Notifications (Admin)
router.get('/notifications', authenticateToken, isAdmin, (req, res) => {
    // Fetch notifications where user_id is NULL (system/admin) or matches admin's ID
    const sql = `SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows || []);
    });
});

// Mark Notification as Read
router.put('/notifications/:id/read', authenticateToken, (req, res) => {
    db.run(`UPDATE notifications SET is_read = TRUE WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// Mark All Notifications as Read
router.put('/notifications/read-all', authenticateToken, (req, res) => {
    db.run(`UPDATE notifications SET is_read = TRUE WHERE (user_id IS NULL OR user_id = ?) AND is_read = FALSE`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All marked as read' });
    });
});

// --- Sync Metrics Dashboard ---
router.get('/sync/metrics', authenticateToken, isAdmin, (req, res) => {
    const result = { backlog: 0, processed_last_5m: 0, avg_latency_ms: null, p95_latency_ms: null };
    const nowMs = Date.now();
    db.get(`SELECT COUNT(*) as total FROM sync_events WHERE processed = FALSE`, [], (bErr, bRow) => {
        result.backlog = (!bErr && bRow && bRow.total) ? Number(bRow.total) : 0;
        db.all(`SELECT created_at, processed_at FROM sync_events WHERE processed = TRUE ORDER BY processed_at DESC LIMIT 500`, [], (pErr, rows) => {
            const latencies = [];
            const recentWindowMs = 5 * 60 * 1000;
            let processedLast5m = 0;
            if (!pErr && Array.isArray(rows)) {
                for (const r of rows) {
                    const c = new Date(r.created_at).getTime();
                    const p = new Date(r.processed_at || r.created_at).getTime();
                    const ms = Math.max(0, p - c);
                    latencies.push(ms);
                    if ((nowMs - p) <= recentWindowMs) processedLast5m++;
                }
            }
            result.processed_last_5m = processedLast5m;
            if (latencies.length) {
                const avg = latencies.reduce((a,b)=>a+b,0) / latencies.length;
                result.avg_latency_ms = Math.round(avg);
                const sorted = latencies.slice().sort((a,b)=>a-b);
                const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length-1] || 0;
                result.p95_latency_ms = Math.round(p95);
            }
            res.json(result);
        });
    });
});

// Clear All Notifications
router.delete('/notifications', authenticateToken, isAdmin, (req, res) => {
    db.run(`DELETE FROM notifications WHERE (user_id IS NULL OR user_id = ?)`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Notifications cleared' });
    });
});
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

// Permanently delete archived cadets (hard delete)
router.post('/cadets/delete-permanent', authenticateToken, isAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Invalid IDs' });
    const placeholders = ids.map(() => '?').join(',');
    const runQuery = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this ? this.changes : 0);
            });
        });
    };
    try {
        await runQuery(`DELETE FROM grades WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM merit_demerit_logs WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM attendance_records WHERE cadet_id IN (${placeholders})`, ids);
        await runQuery(`DELETE FROM excuse_letters WHERE cadet_id IN (${placeholders})`, ids);
        const usersDeleted = await runQuery(`/* HARD_DELETE */ DELETE FROM users WHERE cadet_id IN (${placeholders})`, ids);
        const cadetsDeleted = await runQuery(`/* HARD_DELETE */ DELETE FROM cadets WHERE id IN (${placeholders})`, ids);
        res.json({ message: `Permanently deleted ${cadetsDeleted} cadets and ${usersDeleted} users`, ids });
        try { broadcastEvent({ type: 'cadet_deleted', cadetIds: ids }); } catch {}
    } catch (err) {
        console.error("Permanent delete error:", err);
        res.status(500).json({ message: 'Failed to permanently delete cadets: ' + err.message });
    }
});

// Reclaim Credentials for archived cadets
router.post('/cadets/reclaim-credentials', authenticateToken, isAdmin, async (req, res) => {
    const { cadetIds } = req.body;
    if (!cadetIds || !Array.isArray(cadetIds) || cadetIds.length === 0) {
        return res.status(400).json({ message: 'Invalid cadet IDs' });
    }
    const getUserByCadet = (cadetId) => new Promise((resolve) => {
        db.get(`SELECT id, username, email, is_archived FROM users WHERE cadet_id = ?`, [cadetId], (err, row) => resolve(err ? null : row));
    });
    const updateUser = (id, fields) => new Promise((resolve, reject) => {
        const set = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        const params = Object.values(fields).concat([id]);
        db.run(`UPDATE users SET ${set} WHERE id = ?`, params, function(err) {
            if (err) reject(err);
            else resolve(this ? this.changes : 0);
        });
    });
    const results = [];
    for (const cadetId of cadetIds) {
        const user = await getUserByCadet(cadetId);
        if (!user || !(user.is_archived === true || user.is_archived === 1)) {
            results.push({ cadetId, updated: 0, reason: 'no_archived_user' });
            continue;
        }
        const newUsername = `${user.username || 'user'}__archived_${user.id}`;
        const fields = { username: newUsername, email: null, is_approved: 0 };
        try {
            const changes = await updateUser(user.id, fields);
            results.push({ cadetId, updated: changes, userId: user.id, freed: ['username', 'email'] });
        } catch (e) {
            results.push({ cadetId, updated: 0, error: e.message });
        }
    }
    res.json({ message: 'reclaimed', results });
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

// Debug endpoint: Inspect cadet-related data across tables in one place (admin-only, read-only)
router.get('/debug/cadet/:cadetId', authenticateToken, isAdmin, async (req, res) => {
    const cadetId = Number(req.params.cadetId);
    if (!cadetId || Number.isNaN(cadetId)) {
        return res.status(400).json({ message: 'Invalid cadetId' });
    }
    const pGet = (sql, params = []) => new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(err ? { __error: err.message } : row || null));
    });
    const pAll = (sql, params = []) => new Promise(resolve => {
        db.all(sql, params, (err, rows) => resolve(err ? { __error: err.message } : (rows || [])));
    });
    try {
        const [cadet, user, grades, attendance, trainingDays, meritLogs] = await Promise.all([
            pGet('SELECT * FROM cadets WHERE id = ?', [cadetId]),
            pGet('SELECT * FROM users WHERE cadet_id = ?', [cadetId]),
            pGet('SELECT * FROM grades WHERE cadet_id = ?', [cadetId]),
            pAll('SELECT * FROM attendance_records WHERE cadet_id = ? ORDER BY training_day_id', [cadetId]),
            pAll('SELECT * FROM training_days ORDER BY date', []),
            pAll('SELECT * FROM merit_demerit_logs WHERE cadet_id = ? ORDER BY date_recorded DESC', [cadetId])
        ]);
        res.json({
            cadet,
            user,
            grades,
            attendance,
            trainingDays,
            meritLogs,
            dbInfo: {
                databaseUrlPresent: !!process.env.DATABASE_URL,
                usingExternalDb: !!process.env.DATABASE_URL,
                sqliteFile: process.env.DATABASE_URL ? null : (process.env.DB_FILE || 'rotc_grading.db')
            }
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- Cache Management ---

// Get cache statistics
router.get('/cache/stats', authenticateToken, isAdmin, (req, res) => {
    const stats = getCacheStats();
    res.json({
        hits: stats.hits,
        misses: stats.misses,
        keys: stats.keys,
        hitRate: stats.hits > 0 ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%' : '0%'
    });
});

// Clear all cache
router.post('/cache/clear', authenticateToken, isAdmin, (req, res) => {
    const statsBefore = getCacheStats();
    clearCache();
    const statsAfter = getCacheStats();
    
    res.json({
        message: 'Cache cleared successfully',
        before: {
            keys: statsBefore.keys,
            hits: statsBefore.hits,
            misses: statsBefore.misses
        },
        after: {
            keys: statsAfter.keys,
            hits: statsAfter.hits,
            misses: statsAfter.misses
        }
    });
});

// Sync lifetime merit points from merit_demerit_logs
router.post('/sync-lifetime-merits', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Sync Lifetime Merits] Starting sync...');
        
        // Get all cadets with their current lifetime_merit_points
        const cadets = await new Promise((resolve, reject) => {
            db.all(
                `SELECT c.id, c.first_name, c.last_name, g.lifetime_merit_points 
                 FROM cadets c
                 LEFT JOIN grades g ON g.cadet_id = c.id
                 WHERE (c.is_archived IS FALSE OR c.is_archived IS NULL)`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        console.log(`[Sync Lifetime Merits] Found ${cadets.length} cadets to sync`);

        let syncedCount = 0;
        let errorCount = 0;
        const updates = [];

        for (const cadet of cadets) {
            try {
                // Calculate total merit points from logs
                const meritSum = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT COALESCE(SUM(points), 0) as total 
                         FROM merit_demerit_logs 
                         WHERE cadet_id = ? AND type = 'merit'`,
                        [cadet.id],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row ? row.total : 0);
                        }
                    );
                });

                const currentLifetime = cadet.lifetime_merit_points || 0;
                
                // Only update if there's a difference
                if (meritSum !== currentLifetime) {
                    // Ensure grades row exists
                    await new Promise((resolve, reject) => {
                        db.get(`SELECT id FROM grades WHERE cadet_id = ?`, [cadet.id], (err, row) => {
                            if (err) return reject(err);
                            if (!row) {
                                db.run(`INSERT INTO grades (cadet_id, lifetime_merit_points) VALUES (?, ?)`, 
                                    [cadet.id, meritSum], 
                                    (insErr) => {
                                        if (insErr) reject(insErr);
                                        else resolve();
                                    }
                                );
                            } else {
                                db.run(`UPDATE grades SET lifetime_merit_points = ? WHERE cadet_id = ?`, 
                                    [meritSum, cadet.id], 
                                    (updErr) => {
                                        if (updErr) reject(updErr);
                                        else resolve();
                                    }
                                );
                            }
                        });
                    });

                    updates.push({
                        cadetId: cadet.id,
                        name: `${cadet.first_name} ${cadet.last_name}`,
                        before: currentLifetime,
                        after: meritSum
                    });
                    
                    syncedCount++;
                    console.log(`[Sync] ${cadet.first_name} ${cadet.last_name}: ${currentLifetime} → ${meritSum}`);
                }
            } catch (err) {
                console.error(`[Sync] Error syncing cadet ${cadet.id}:`, err);
                errorCount++;
            }
        }

        // Invalidate cache for all cadets
        clearCache();

        console.log(`[Sync Lifetime Merits] Complete: ${syncedCount} synced, ${errorCount} errors`);

        res.json({
            message: 'Lifetime merit points synced successfully',
            totalCadets: cadets.length,
            syncedCount,
            errorCount,
            updates: updates.slice(0, 10) // Return first 10 updates for display
        });

    } catch (err) {
        console.error('[Sync Lifetime Merits] Error:', err);
        res.status(500).json({ 
            message: 'Failed to sync lifetime merit points',
            error: err.message 
        });
    }
});

// Force database optimization (create indexes if missing)
router.post('/force-optimize-db', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Force Optimize] Starting database optimization...');
        const results = {
            indexesCreated: 0,
            migrationsRun: 0,
            errors: [],
            before: null,
            after: null
        };

        // Capture metrics before
        try {
            const { getMetricsSnapshot } = require('./metrics');
            results.before = getMetricsSnapshot();
        } catch (_) {}

        // Create performance indexes
        try {
            const { migrate } = require('../migrations/create_performance_indexes');
            const indexResults = await migrate();
            results.indexesCreated = indexResults.created.length;
            results.indexesExisting = indexResults.existing.length;
            results.indexesFailed = indexResults.failed.length;
            console.log('[Force Optimize] Performance indexes created:', indexResults.created.length);
        } catch (err) {
            console.error('[Force Optimize] Index creation error:', err);
            results.errors.push(`Indexes: ${err.message}`);
        }

        // Add lifetime_merit_points column
        try {
            const { addLifetimeMeritPoints } = require('../migrations/add_lifetime_merit_points');
            await addLifetimeMeritPoints();
            results.migrationsRun++;
            console.log('[Force Optimize] Lifetime merit points migration completed');
        } catch (err) {
            // This migration might fail if column already exists, which is fine
            if (err.message && err.message.includes('already exists')) {
                console.log('[Force Optimize] Lifetime merit points column already exists');
            } else {
                console.error('[Force Optimize] Migration error:', err);
                results.errors.push(`Migration: ${err.message}`);
            }
        }

        // Clear cache
        clearCache();
        results.cacheCleared = true;

        // Capture metrics after
        try {
            const { getMetricsSnapshot } = require('./metrics');
            results.after = getMetricsSnapshot();
        } catch (_) {}

        console.log('[Force Optimize] Database optimization complete');

        res.json({
            message: 'Database optimization completed',
            ...results,
            success: results.errors.length === 0
        });

    } catch (err) {
        console.error('[Force Optimize] Error:', err);
        res.status(500).json({ 
            message: 'Database optimization failed',
            error: err.message 
        });
    }
});

module.exports = router;
