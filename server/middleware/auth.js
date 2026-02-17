const allowed = new Set(['admin', 'cadet', 'training_staff']);
const bypass = ((process.env.BYPASS_AUTH || 'true') + '').toLowerCase() === 'true';
const defaultRole = process.env.DEFAULT_ROLE || 'admin';
const expectedToken = process.env.API_TOKEN || 'dev-token';
let db = null;
try { db = require('../database'); } catch (_) {}

// In-memory session store (for development - use Redis/JWT in production)
const sessions = new Map();

function authenticateToken(req, res, next) {
  if (bypass) {
    const user = { id: 1, role: defaultRole };
    if (defaultRole === 'cadet' && db) {
      try {
        db.get(`SELECT cadet_id FROM users WHERE id = ?`, [user.id], (err, row) => {
          if (!err && row && row.cadet_id) {
            req.user = { ...user, cadetId: row.cadet_id };
            return next();
          }
          db.get(`SELECT id FROM cadets ORDER BY id ASC LIMIT 1`, [], (e2, r2) => {
            req.user = { ...user, cadetId: r2 && r2.id ? r2.id : undefined };
            return next();
          });
        });
        return;
      } catch (_) {
        // fall-through
      }
    }
    req.user = user;
    return next();
  }
  
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  // Check if token matches expected token
  if (token === expectedToken) {
    // For simple token auth, we need to get user info from session or default
    const session = sessions.get(token);
    if (session) {
      req.user = session;
      return next();
    }
    // Fallback to default user if no session found
    req.user = { id: 1, role: defaultRole };
    return next();
  }
  
  res.status(401).json({ message: 'Invalid token' });
}

function setSession(token, userData) {
  sessions.set(token, userData);
}

function clearSession(token) {
  sessions.delete(token);
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Forbidden' });
}

function isAdminOrPrivilegedStaff(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'training_staff')) return next();
  res.status(403).json({ message: 'Forbidden' });
}

module.exports = { authenticateToken, isAdmin, isAdminOrPrivilegedStaff, setSession, clearSession };
