const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateToken, setSession, clearSession } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

// In-memory settings store (ephemeral on server restarts)
let currentSettings = {
  email_alerts: true,
  push_notifications: true,
  activity_updates: true,
  dark_mode: false,
  compact_mode: false,
  primary_color: 'default',
  custom_bg: null
};

// Heartbeat: accepts GET or POST for flexibility
router.get('/heartbeat', (req, res) => {
  res.json({
    status: 'ok',
    method: 'GET',
    timestamp: Date.now()
  });
});

router.post('/heartbeat', (req, res) => {
  res.json({
    status: 'ok',
    method: 'POST',
    timestamp: Date.now()
  });
});

// Admin login with database verification
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin'], async (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = process.env.API_TOKEN || 'dev-token';
    
    // Store session
    setSession(token, {
      id: user.id,
      role: 'admin',
      cadetId: null,
      staffId: null
    });
    
    res.json({
      token,
      role: 'admin',
      cadetId: null,
      staffId: null,
      isProfileCompleted: true,
      username: user.username,
      userId: user.id
    });
  });
});

// Cadet login using identifier (student ID / email / username)
router.post('/cadet-login', async (req, res) => {
  const { identifier, password } = req.body;
  
  if (!identifier) {
    return res.status(400).json({ message: 'Identifier is required' });
  }
  
  // Query for user by username, email, or student_id
  const sql = `
    SELECT u.*, c.is_profile_completed, c.student_id 
    FROM users u 
    LEFT JOIN cadets c ON u.cadet_id = c.id 
    WHERE (u.username = ? OR u.email = ? OR c.student_id = ?) 
    AND u.role = 'cadet'
    LIMIT 1
  `;
  
  db.get(sql, [identifier, identifier, identifier], async (err, user) => {
    if (err) {
      console.error('[Cadet Login] Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // If password is provided and user has a password, verify it
    if (password && user.password) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    
    const token = process.env.API_TOKEN || 'dev-token';
    
    // Store session
    setSession(token, {
      id: user.id,
      role: 'cadet',
      cadetId: user.cadet_id,
      staffId: null
    });
    
    res.json({
      token,
      role: 'cadet',
      cadetId: user.cadet_id,
      staffId: null,
      isProfileCompleted: user.is_profile_completed || false,
      identifier: user.username,
      userId: user.id
    });
  });
});

// Staff login using identifier (username / email)
router.post('/staff-login-no-pass', async (req, res) => {
  const { identifier, password } = req.body;
  
  if (!identifier) {
    return res.status(400).json({ message: 'Identifier is required' });
  }
  
  const sql = `
    SELECT u.*, s.id as staff_id 
    FROM users u 
    LEFT JOIN training_staff s ON u.staff_id = s.id 
    WHERE (u.username = ? OR u.email = ?) 
    AND u.role = 'training_staff'
    LIMIT 1
  `;
  
  db.get(sql, [identifier, identifier], async (err, user) => {
    if (err) {
      console.error('[Staff Login] Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // If password is provided and user has a password, verify it
    if (password && user.password) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    
    const token = process.env.API_TOKEN || 'dev-token';
    
    // Store session
    setSession(token, {
      id: user.id,
      role: 'training_staff',
      cadetId: null,
      staffId: user.staff_id
    });
    
    res.json({
      token,
      role: 'training_staff',
      cadetId: null,
      staffId: user.staff_id,
      isProfileCompleted: true,
      identifier: user.username,
      userId: user.id
    });
  });
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  clearSession(token);
  res.json({ message: 'Logged out successfully' });
});

// Read settings
router.get('/settings', authenticateToken, (req, res) => {
  res.json(currentSettings);
});

// Update settings
router.put('/settings', authenticateToken, (req, res) => {
  const {
    email_alerts,
    push_notifications,
    activity_updates,
    dark_mode,
    compact_mode,
    primary_color,
    custom_bg
  } = req.body || {};

  currentSettings = {
    ...currentSettings,
    ...(typeof email_alerts === 'boolean' ? { email_alerts } : {}),
    ...(typeof push_notifications === 'boolean' ? { push_notifications } : {}),
    ...(typeof activity_updates === 'boolean' ? { activity_updates } : {}),
    ...(typeof dark_mode === 'boolean' ? { dark_mode } : {}),
    ...(typeof compact_mode === 'boolean' ? { compact_mode } : {}),
    ...(primary_color ? { primary_color } : {}),
    ...(custom_bg !== undefined ? { custom_bg } : {})
  };

  res.json({ success: true, settings: currentSettings });
});

// Upload background image
router.post('/settings/background', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    // Cloudinary adapter returns path/url on req.file.path; local storage returns filename with disk path
    const url = req.file.path || (req.file.filename ? `/uploads/${req.file.filename}` : null);
    if (!url) {
      return res.status(500).json({ message: 'Upload failed' });
    }
    currentSettings.custom_bg = url;
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload error' });
  }
});

module.exports = router;
