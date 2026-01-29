const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const db = require('../database');

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

const upsertUser = (cadetId, studentId, email, customUsername) => {
    return new Promise(async (resolve, reject) => {
        try {
            const existingUser = await getUserByCadetId(cadetId);
            const username = customUsername || studentId;
            if (!existingUser) {
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
                db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [username, dummyHash, 'cadet', cadetId, 1, email], 
                    (err) => {
                        if (err) {
                            if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key value violates unique constraint')) {
                                resolve();
                            } else {
                                reject(err);
                            }
                        }
                        else {
                            db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
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

const getCadetByName = (firstName, lastName, middleName) => {
    return new Promise((resolve, reject) => {
        // Try to match by First Name and Last Name first
        // If Middle Name is provided, use it to refine
        let sql = 'SELECT * FROM cadets WHERE first_name = ? AND last_name = ?';
        let params = [firstName, lastName];
        
        if (middleName) {
            sql += ' AND middle_name = ?';
            params.push(middleName);
        }
        
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const processCadetData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    for (const row of data) {
        const email = findColumnValue(row, ['Email', 'email', 'E-mail']);
        let studentId = findColumnValue(row, ['Username', 'username', 'User Name']); // Priority 1: Username
        
        // Priority 2: Student ID (fallback if username is missing)
        if (!studentId) {
            studentId = findColumnValue(row, ['Student ID', 'student_id', 'ID', 'StudentId']);
        }
        
        const customUsername = studentId; // Now effectively the same, but kept for logic consistency
        
        if (!studentId) {
            if (email) {
                studentId = email;
            }
        }
        
        let lastName = findColumnValue(row, ['Last Name', 'last_name', 'Surname', 'LName']);
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName']);
        let middleName = findColumnValue(row, ['Middle Name', 'middle_name', 'MName']) || '';
        
        // If Name is missing, try to extract from ID/Email
        if (!firstName || !lastName) {
             if (studentId) {
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
        }

        if (!studentId && (!firstName || !lastName)) {
            failCount++;
            const availableKeys = Object.keys(row).join(', ');
            errors.push(`Missing Student ID or Name. Found columns: ${availableKeys}`);
            continue;
        }

        // Auto-generate Username (Student ID) if missing
        if (!studentId && firstName && lastName) {
            // Format: firstname.lastname (lowercase, no spaces)
            const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
            studentId = `${cleanFirst}.${cleanLast}`;
        }

        const cadetData = {
            student_id: studentId,
            last_name: lastName,
            first_name: firstName,
            middle_name: middleName,
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
            let existingCadet = null;
            
            // Priority 1: Find by Student ID
            if (studentId) {
                existingCadet = await getCadetByStudentId(studentId);
            }
            
            // Priority 2: Find by Name (First + Middle + Last)
            if (!existingCadet && firstName && lastName) {
                existingCadet = await getCadetByName(firstName, lastName, middleName);
            }
            
            if (existingCadet) {
                cadetId = existingCadet.id;
                // Update
                await updateCadet(cadetId, cadetData);
                
                // If we matched by Name but input has a new Student ID, we should probably update it?
                // But Student ID is usually immutable or unique.
                // For now, let's assume we update everything EXCEPT student_id if it's null in input.
                // But cadetData.student_id might be null if we didn't find it.
                // If we matched by name, we might want to preserve the existing student_id if input is missing it.
                if (!cadetData.student_id) {
                     // Keep existing ID for user upsert
                     // But wait, updateCadet uses cadetData.student_id? 
                     // No, updateCadet function doesn't update student_id in the SQL I wrote earlier?
                     // Let's check updateCadet implementation.
                }
            } else {
                // Insert
                if (studentId) {
                    cadetId = await insertCadet(cadetData);
                } else {
                    // Cannot insert without Student ID
                    throw new Error("Cannot create new cadet without Student ID");
                }
            }
            
            // Upsert User Account
            // Use existing student_id if we have it
            const effectiveStudentId = existingCadet ? existingCadet.student_id : studentId;
            if (effectiveStudentId) {
                 await upsertUser(cadetId, effectiveStudentId, cadetData.email, customUsername);
            }
            
            successCount++;
        } catch (err) {
            failCount++;
            errors.push(`${studentId || firstName + ' ' + lastName}: ${err.message}`);
        }
    }
    return { successCount, failCount, errors };
};

const getStaffByName = (firstName, lastName) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM training_staff WHERE first_name = ? AND last_name = ?', [firstName, lastName], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const insertTrainingStaff = (staff) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO training_staff (rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            staff.rank || '', staff.first_name, staff.middle_name || '', staff.last_name, staff.suffix_name || '',
            staff.email || null, staff.contact_number || '', staff.role || 'Instructor'
        ];
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

const upsertStaffUser = (staffId, email, customUsername, firstName, lastName) => {
    return new Promise((resolve, reject) => {
        const generateUsername = () => {
            if (customUsername) return customUsername;
            if (email) return email.split('@')[0];
            return `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z0-9]/g, '');
        };
        
        const username = generateUsername();
        const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
        
        // Check if user exists for this staff
        db.get('SELECT * FROM users WHERE staff_id = ?', [staffId], (err, row) => {
            if (err) return reject(err);
            
            if (!row) {
                // Create user
                const insertUser = (uName) => {
                    db.run(`INSERT INTO users (username, password, role, staff_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                        [uName, dummyHash, 'training_staff', staffId, 1, email], 
                        (err) => {
                            if (err) {
                                // If username taken, try appending number
                                if (err.message.includes('UNIQUE constraint') || err.message.includes('duplicate key')) {
                                    const newUsername = uName + Math.floor(Math.random() * 1000);
                                    insertUser(newUsername);
                                } else {
                                    reject(err);
                                }
                            } else {
                                resolve();
                            }
                        }
                    );
                };
                insertUser(username);
            } else {
                // Update email if provided
                if (email) {
                     db.run(`UPDATE users SET email = ? WHERE id = ?`, [email, row.id], (err) => {
                         if (err) reject(err);
                         else resolve();
                     });
                } else {
                    resolve();
                }
            }
        });
    });
};

const processStaffData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const row of data) {
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName', 'Given Name']);
        let lastName = findColumnValue(row, ['Last Name', 'last_name', 'Surname', 'LName']);
        let middleName = findColumnValue(row, ['Middle Name', 'middle_name', 'MName']);
        
        if (!firstName || !lastName) {
             failCount++;
             errors.push(`Missing First Name or Last Name. Found columns: ${Object.keys(row).join(', ')}`);
             continue;
        }
        
        const email = findColumnValue(row, ['Email', 'email', 'E-mail']);
        const username = findColumnValue(row, ['Username', 'username', 'User Name']);
        
        const staffData = {
            rank: findColumnValue(row, ['Rank', 'rank']) || 'Mr/Ms',
            first_name: firstName,
            middle_name: middleName || '',
            last_name: lastName,
            suffix_name: findColumnValue(row, ['Suffix', 'suffix_name']) || '',
            email: email || null,
            contact_number: findColumnValue(row, ['Contact Number', 'contact_number', 'Mobile']) || '',
            role: findColumnValue(row, ['Role', 'role']) || 'Instructor'
        };
        
        try {
            let staffId;
            // Priority: Find by Name (First + Last + Middle)
            const existingStaff = await getStaffByName(firstName, lastName, middleName);
            
            if (existingStaff) {
                staffId = existingStaff.id;
            } else {
                staffId = await insertTrainingStaff(staffData);
            }
            
            await upsertStaffUser(staffId, email, username, firstName, lastName);
            successCount++;
        } catch (err) {
            failCount++;
            errors.push(`${firstName} ${lastName}: ${err.message}`);
        }
    }
    
    return { successCount, failCount, errors };
};

const getDirectDownloadUrl = (url) => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('google.com')) {
            if (urlObj.pathname.includes('/spreadsheets/')) {
                return url.replace(/\/edit.*$/, '/export?format=xlsx');
            }
        }
        if (urlObj.hostname.includes('dropbox.com')) {
            if (url.includes('dl=1')) return url;
            if (url.includes('dl=0')) return url.replace('dl=0', 'dl=1');
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}dl=1`;
        }
        if (urlObj.hostname.includes('onedrive.live.com') || 
            urlObj.hostname.includes('sharepoint.com') || 
            urlObj.hostname.includes('1drv.ms')) {
            if (url.includes('/embed')) {
                return url.replace('/embed', '/download');
            }
            if (url.includes('/view.aspx')) {
                return url.replace('/view.aspx', '/download');
            }
            if (url.includes('/redir')) {
                return url.replace('/redir', '/download');
            }
            if (url.includes('Doc.aspx')) {
                if (url.includes('action=')) {
                    return url.replace(/action=[^&]+/, 'action=download');
                } else {
                    const separator = url.includes('?') ? '&' : '?';
                    return `${url}${separator}action=download`;
                }
            }
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
        // Match standard Student ID formats: YYYY-NNNNNN or just NNNNNN (at least 5 digits)
        const idMatch = line.match(/\b\d{4}[-]?\d{3,}\b/) || line.match(/\b\d{5,}\b/);
        
        if (idMatch) {
            const studentId = idMatch[0];
            const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            const email = emailMatch ? emailMatch[0] : '';
            let cleanLine = line.replace(studentId, '').replace(email, '').trim();
            
            // Clean up any remaining non-name characters (like bullets, numbering) if they are at start
            cleanLine = cleanLine.replace(/^[\d.)\-\s]+/, '');

            let lastName = '';
            let firstName = '';
            let middleName = '';
            
            if (cleanLine.includes(',')) {
                // Format: Last Name, First Name Middle Name
                const parts = cleanLine.split(',');
                lastName = parts[0].trim();
                const rest = parts.slice(1).join(' ').trim();
                firstName = rest;
            } else {
                // Format: First Name Middle Name Last Name (Assumed if no comma)
                // Or: Last Name First Name (Military style without comma? Risky. sticking to First Last)
                const parts = cleanLine.split(/\s+/);
                if (parts.length > 1) {
                    lastName = parts.pop();
                    firstName = parts.join(' ');
                } else {
                    lastName = cleanLine;
                    firstName = 'Unknown';
                }
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
        throw new Error('No cadet records detected in PDF.');
    }
    return data;
};

const processUrlImport = async (url) => {
    // Helper to resolve short links (like 1drv.ms)
    const resolveShortLink = async (shortUrl) => {
        try {
            const resp = await axios.get(shortUrl, {
                maxRedirects: 0,
                validateStatus: status => status >= 300 && status < 400
            });
            if (resp.headers.location) return resp.headers.location;
        } catch (e) {
            // If it doesn't redirect, maybe it's 200 OK (already resolved?)
        }
        return shortUrl;
    };

    let currentUrl = url;
    if (url.includes('1drv.ms')) {
        currentUrl = await resolveShortLink(url);
    }
    
    // Initial transformation
    currentUrl = getDirectDownloadUrl(currentUrl);

    const fetchFile = async (targetUrl, ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36') => {
        const headers = {};
        if (ua) headers['User-Agent'] = ua;
        
        const response = await axios.get(targetUrl, { 
            responseType: 'arraybuffer',
            headers: headers,
            validateStatus: (status) => status < 400 || (status >= 300 && status < 400),
            maxRedirects: 0
        });
        return response;
    };

    try {
        let response;
        let buffer;
        let contentType;
        
        // Strategy for OneDrive: Try multiple candidates if first attempt returns HTML
        const candidates = [];
        candidates.push({ url: currentUrl, ua: 'Mozilla/5.0' });

        // If it's a OneDrive link, add more candidates
        if (currentUrl.includes('onedrive.live.com') || currentUrl.includes('sharepoint.com')) {
             try {
                const u = new URL(currentUrl);
                const pathParts = u.pathname.split('/');
                let cid = null;
                let authkey = null;
                let resid = u.searchParams.get('resid');
                
                const personalIndex = pathParts.findIndex(p => p.toLowerCase() === 'personal');
                if (personalIndex !== -1 && pathParts.length > personalIndex + 2) {
                    cid = pathParts[personalIndex + 1];
                    authkey = pathParts[personalIndex + 2];
                }
                if (!cid && resid) cid = resid.split('!')[0];

                if (resid && authkey) {
                    // Embed
                    candidates.push({ url: `https://onedrive.live.com/embed?cid=${cid}&resid=${resid}&authkey=${authkey}&em=2`, ua: 'Mozilla/5.0' });
                    // Export
                    candidates.push({ url: `https://onedrive.live.com/export?cid=${cid}&resid=${resid}&authkey=${authkey}&format=xlsx`, ua: 'Mozilla/5.0' });
                    // Legacy Download
                    candidates.push({ url: `https://onedrive.live.com/download?cid=${cid}&resid=${resid}&authkey=${authkey}`, ua: 'Mozilla/5.0' });
                    // No UA
                    candidates.push({ url: `https://onedrive.live.com/download?cid=${cid}&resid=${resid}&authkey=${authkey}`, ua: null });
                }
             } catch(e) {}
        }

        let success = false;
        let lastError = null;

        for (const candidate of candidates) {
            const targetUrl = typeof candidate === 'string' ? candidate : candidate.url;
            const ua = typeof candidate === 'object' ? candidate.ua : 'Mozilla/5.0'; // Default UA

            try {
                // Handle Redirects for this candidate
                let loopUrl = targetUrl;
                let redirectCount = 0;
                const maxRedirects = 5;
                
                while (redirectCount < maxRedirects) {
                    response = await fetchFile(loopUrl, ua);
                    
                    if (response.status >= 300 && response.headers.location) {
                        redirectCount++;
                        let redirectUrl = response.headers.location;
                        if (redirectUrl.startsWith('/')) {
                            const u = new URL(loopUrl);
                            redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                        }
                        // Transform redirect if needed
                        if ((redirectUrl.includes('onedrive.live.com') || redirectUrl.includes('sharepoint.com')) && !redirectUrl.includes('download=1') && !redirectUrl.includes('export=') && !redirectUrl.includes('embed?')) {
                             const u = new URL(redirectUrl);
                             if (u.pathname.endsWith('.xlsx') || u.pathname.endsWith('.xls')) {
                                 redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'download=1';
                             }
                        }
                        loopUrl = redirectUrl;
                        continue;
                    }
                    
                    // Check Content
                    buffer = Buffer.from(response.data);
                    contentType = response.headers['content-type'];
                    const firstBytes = buffer.slice(0, 100).toString().trim().toLowerCase();
                    
                    if (firstBytes.includes('<!doctype html') || firstBytes.includes('<html') || firstBytes.startsWith('<!--')) {
                         // HTML detected
                         throw new Error('Returned HTML');
                    }
                    
                    // Success!
                    success = true;
                    break;
                }
                if (success) break;
            } catch (e) {
                lastError = e;
                continue; // Try next candidate
            }
        }

        if (!success) {
            if (lastError) throw lastError;
            throw new Error('All download attempts failed or returned HTML.');
        }

        let data = [];
        if (contentType && contentType.includes('pdf')) {
            try {
                data = await parsePdfBuffer(buffer);
            } catch (err) {
                throw new Error('Failed to parse PDF from URL: ' + err.message);
            }
        } else {
            try {
                const workbook = xlsx.read(buffer, { type: 'buffer' });
                if (workbook.SheetNames.length === 0) throw new Error('Excel file is empty');
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const sheetData = xlsx.utils.sheet_to_json(sheet);
                    data = data.concat(sheetData);
                });
            } catch (err) {
                throw new Error(`Failed to parse Excel file. content-type: ${contentType}. Error: ${err.message}`);
            }
        }
        if (!data || data.length === 0) {
            throw new Error('No data found in the imported file.');
        }
        return await processCadetData(data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            if (err.response && err.response.status === 403) {
                throw new Error('Access Denied (403). The link might be private or require a login.');
            }
            if (err.response && err.response.status === 404) {
                throw new Error('File not found (404).');
            }
            throw new Error(`Network/Connection Error: ${err.message}.`);
        }
        throw err;
    }
};

module.exports = {
    processCadetData,
    processStaffData,
    processUrlImport,
    getDirectDownloadUrl,
    parsePdfBuffer
};
