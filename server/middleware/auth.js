const allowed = new Set(['admin', 'cadet', 'training_staff']);
const bypass = ((process.env.BYPASS_AUTH || 'true') + '').toLowerCase() === 'true';
const defaultRole = process.env.DEFAULT_ROLE || 'admin';
const expectedToken = process.env.API_TOKEN || 'dev-token';

function authenticateToken(req, res, next) {
  if (bypass) {
    req.user = { id: 1, role: defaultRole };
    return next();
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (token && token === expectedToken) {
    req.user = { id: 1, role: defaultRole };
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Forbidden' });
}

function isAdminOrPrivilegedStaff(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'training_staff')) return next();
  res.status(403).json({ message: 'Forbidden' });
}

module.exports = { authenticateToken, isAdmin, isAdminOrPrivilegedStaff };
