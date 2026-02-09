const jwt = require('jsonwebtoken');
const db = require('../database');

const SECRET_KEY = process.env.JWT_SECRET || 'rotc_super_secret_key'; // In prod, use env var

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Session expired or invalid token' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ message: 'Admin access required' });
};

const PRIVILEGED_STAFF_ROLES = new Set([
    'Commandant',
    'Assistant Commandant',
    'NSTP Director',
    'ROTC Coordinator',
    'Admin NCO'
]);

const isAdminOrPrivilegedStaff = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    if (!req.user || req.user.role !== 'training_staff' || !req.user.staffId) {
        return res.status(403).json({ message: 'Admin access required' });
    }

    db.get('SELECT role FROM training_staff WHERE id = ?', [req.user.staffId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        if (row && row.role && PRIVILEGED_STAFF_ROLES.has(row.role)) {
            return next();
        }
        return res.status(403).json({ message: 'Admin access required' });
    });
};

module.exports = { authenticateToken, isAdmin, isAdminOrPrivilegedStaff, SECRET_KEY };
