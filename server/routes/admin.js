const express = require('express');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// Multer Setup (Memory Storage for Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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
            cadet_course, semester, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.student_id, cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
            cadet.cadet_course || '', cadet.semester || '', 'Ongoing'
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
                let sql = `UPDATE users SET email = ?, is_approved = 1`;
                const params = [email];
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
    const keys = Object.keys(row);
    for (const key of keys) {
        const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const name of possibleNames) {
            const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedKey === normalizedName) return row[key];
        }
    }
    return undefined;
};

const processCadetData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const row of data) {
        let studentId = findColumnValue(row, ['Student ID', 'student_id', 'ID', 'StudentId']);
        const customUsername = findColumnValue(row, ['Username', 'username', 'User Name']);
        const email = findColumnValue(row, ['Email', 'email', 'E-mail']);

        if (!studentId) {
            if (customUsername) {
                studentId = customUsername;
            } else if (email) {
                studentId = email;
            } else {
                const lName = findColumnValue(row, ['Last Name', 'last_name', 'Surname', 'LName']);
                const fName = findColumnValue(row, ['First Name', 'first_name', 'FName']);
                
                if (lName && fName) {
                    const cleanLast = lName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    const cleanFirst = fName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    studentId = `${cleanLast}.${cleanFirst}`;
                }
            }
        }
        
        if (!studentId) {
            failCount++;
            const availableKeys = Object.keys(row).join(', ');
            errors.push(`Missing Student ID, Username, Email, or Name. Found columns: ${availableKeys}`);
            continue;
        }

        let lastName = findColumnValue(row, ['Last Name', 'last_name', 'Surname', 'LName']);
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName']);

        if (!firstName || !lastName) {
            const baseStr = studentId.split('@')[0]; 
            const parts = baseStr.split(/[._, ]+/).filter(Boolean);
            if (parts.length >= 2) {
                if (!firstName) firstName = parts[0] || 'Unknown';
                if (!lastName) lastName = parts.slice(1).join(' ') || 'Cadet';
            } else {
                if (!firstName) firstName = baseStr || 'Unknown';
                if (!lastName) lastName = 'Cadet';
            }
            
            const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
            firstName = firstName.split(' ').map(capitalize).join(' ');
            lastName = lastName.split(' ').map(capitalize).join(' ');
        }

        const cadetData = {
            student_id: studentId,
            last_name: lastName,
            first_name: firstName,
            middle_name: findColumnValue(row, ['Middle Name', 'middle_name', 'MName']) || '',
            suffix_name: findColumnValue(row, ['Suffix', 'suffix_name']) || '',
            rank: findColumnValue(row, ['Rank', 'rank']) || 'Cdt',
            email: email || '',
            contact_number: findColumnValue(row, ['Contact Number', 'contact_number', 'Mobile', 'Phone']) || '',
            address: findColumnValue(row, ['Address', 'address']) || '',
            course: findColumnValue(row, ['Course', 'course']) || '',
            year_level: findColumnValue(row, ['Year Level', 'year_level', 'Year']) || '',
            school_year: findColumnValue(row, ['School Year', 'school_year', 'SY']) || '',
            battalion: findColumnValue(row, ['Battalion', 'battalion']) || '',
            company: findColumnValue(row, ['Company', 'company']) || '',
            platoon: findColumnValue(row, ['Platoon', 'platoon']) || '',
            cadet_course: findColumnValue(row, ['Cadet Course', 'cadet_course']) || '', 
            semester: findColumnValue(row, ['Semester', 'semester']) || ''
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

            await upsertUser(cadetId, studentId, cadetData.email, customUsername, firstName);
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
router.use(isAdmin);

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
                 throw new Error(`File not found (404). Please check the link.`);
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

router.get('/settings/cadet-source', (req, res) => {
    db.get("SELECT value FROM system_settings WHERE key = 'cadet_list_source_url'", [], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ url: row ? row.value : null });
    });
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

            // 2. Get Grade Stats (Reuse cadet grade logic)
            const cadetsSql = `
                SELECT c.*, 
                       g.attendance_present, g.merit_points, g.demerit_points, 
                       g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status
                FROM cadets c
                JOIN users u ON u.cadet_id = c.id
                LEFT JOIN grades g ON c.id = g.cadet_id
                WHERE u.is_approved = 1
            `;

            db.all(cadetsSql, [], (err, cadetRows) => {
                if (err) return res.status(500).json({ message: err.message });

                cadetRows.forEach(cadet => {
                    const safeTotalDays = totalTrainingDays > 0 ? totalTrainingDays : 1;
                    const attendanceScore = (cadet.attendance_present / safeTotalDays) * 30;
                    
                    // Aptitude: Base 100 + Merits - Demerits (Capped at 100)
                    // "The cadets have already 100 merit points... ceiling value will be up to 100 points only"
                    // "Merit points minus demerit points then the result will be multiply by 30%"
                    let rawAptitude = 100 + (cadet.merit_points || 0) - (cadet.demerit_points || 0);
                    if (rawAptitude > 100) rawAptitude = 100;
                    // Ensure it doesn't go below 0 (implied, though not explicitly stated, negative grades are weird)
                    if (rawAptitude < 0) rawAptitude = 0; 
                    
                    const aptitudeScore = rawAptitude * 0.3;

                    // Subject Proficiency: (Sum / Total Items) * 40%
                    // Assuming 300 total items for now
                    const subjectScore = ((cadet.prelim_score + cadet.midterm_score + cadet.final_score) / 300) * 40;
                    
                    const finalGrade = attendanceScore + aptitudeScore + subjectScore;
                    
                    const { remarks } = calculateTransmutedGrade(finalGrade, cadet.grade_status);

                    if (remarks === 'Passed') analyticsData.grades.passed++;
                    else if (remarks === 'Failed') analyticsData.grades.failed++;
                    
                    if (['INC', 'DO', 'T'].includes(cadet.grade_status)) {
                        analyticsData.grades.incomplete++;
                        analyticsData.grades.failed--; 
                    }
                });

                res.json(analyticsData);
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
                cadet_course, semester, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                cadet.rank || '', cadet.firstName || '', cadet.middleName || '', cadet.lastName || '', cadet.suffixName || '',
                cadet.studentId, cadet.email || '', cadet.contactNumber || '', cadet.address || '',
                cadet.course || '', cadet.yearLevel || '', cadet.schoolYear || '',
                cadet.battalion || '', cadet.company || '', cadet.platoon || '',
                cadet.cadetCourse || '', cadet.semester || '', cadet.status || 'Ongoing'
            ];

            db.run(insertSql, params, function(err) {
                if (err) return res.status(500).json({ message: err.message });
                const newCadetId = this.lastID;

                // Create User Account (Auto-approved)
                const username = cadet.firstName || cadet.studentId; // Default to First Name
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
                
                db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [username, dummyHash, 'cadet', newCadetId, 1, cadet.email || ''], 
                    (err) => {
                        if (err) console.error("Error creating user for new cadet:", err);
                        
                        // Initialize Grades
                        db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [newCadetId], (err) => {
                            if (err) console.error("Error initializing grades:", err);
                            res.status(201).json({ message: 'Cadet created successfully', id: newCadetId });
                        });
                    }
                );
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
            SELECT c.*, u.username,
                   g.attendance_present, g.merit_points, g.demerit_points, 
                   g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status
            FROM cadets c
            JOIN users u ON u.cadet_id = c.id
            LEFT JOIN grades g ON c.id = g.cadet_id
            WHERE u.is_approved = 1
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
router.put('/cadets/:id', (req, res) => {
    const { 
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status 
    } = req.body;

    const sql = `UPDATE cadets SET 
        rank=?, first_name=?, middle_name=?, last_name=?, suffix_name=?, 
        student_id=?, email=?, contact_number=?, address=?, 
        course=?, year_level=?, school_year=?, 
        battalion=?, company=?, platoon=?, 
        cadet_course=?, semester=?, status=? 
        WHERE id=?`;

    const params = [
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status, 
        req.params.id
    ];

    db.run(sql, params, (err) => {
            if (err) return res.status(500).json({ message: err.message });
            
            // Sync with Users table (Email/Username)
            // If email or first name changed, we might want to update user credentials,
            // but for now, let's at least sync the email so they can login with it.
            if (email) {
                db.run(`UPDATE users SET email = ? WHERE cadet_id = ?`, [email, req.params.id], (uErr) => {
                    if (uErr) console.error("Error syncing user email:", uErr);
                });
            }

            res.json({ message: 'Cadet updated' });
        }
    );
});

// Delete Cadet (Bulk)
router.post('/cadets/delete', (req, res) => {
    const { ids } = req.body; // Expecting array of IDs
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM cadets WHERE id IN (${placeholders})`;

    db.run(sql, ids, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Deleted ${this.changes} cadets` });
    });
});

// --- Grading Management ---

// Update Grades for a Cadet
router.put('/grades/:cadetId', (req, res) => {
    const { meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status } = req.body;
    const cadetId = req.params.cadetId;

    // Note: attendance_present is excluded from manual update to prevent overwriting 
    // the value synchronized from the Attendance module.
    db.run(`UPDATE grades SET 
            merit_points = ?, 
            demerit_points = ?, 
            prelim_score = ?, 
            midterm_score = ?, 
            final_score = ?,
            status = ?
            WHERE cadet_id = ?`,
        [meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status || 'active', cadetId],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            // Send Email Notification
            db.get(`SELECT email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], async (err, cadet) => {
                if (!err && cadet && cadet.email) {
                    const subject = 'ROTC Grading System - Grades Updated';
                    const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nYour grades have been updated by the admin.\n\nPlease log in to the portal to view your latest standing.\n\nRegards,\nROTC Admin`;
                    const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>Your grades have been updated by the admin.</p><p>Please log in to the portal to view your latest standing.</p><p>Regards,<br>ROTC Admin</p>`;
                    
                    await sendEmail(cadet.email, subject, text, html);
                }
                res.json({ message: 'Grades updated' });
            });
        }
    );
});

// --- Activity Management ---

// Upload Activity
router.post('/activities', upload.single('image'), (req, res) => {
    const { title, description, date } = req.body;
    
    // Convert buffer to Base64 Data URI if file exists
    let imagePath = null;
    if (req.file) {
        imagePath = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    db.run(`INSERT INTO activities (title, description, date, image_path) VALUES (?, ?, ?, ?)`,
        [title, description, date, imagePath],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ id: this.lastID, message: 'Activity created' });
        }
    );
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
    let sql = `SELECT u.id, u.username, u.role, u.is_approved, u.email, u.profile_pic, 
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

// Get Current Admin Profile
router.get('/profile', (req, res) => {
    db.get(`SELECT id, username, email, profile_pic FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(row);
    });
});

// Update Admin Profile (Pic)
router.put('/profile', upload.single('profilePic'), (req, res) => {
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
                res.json({ message: 'Log deleted and points reverted' });
            });
        });
    });
});

module.exports = router;
