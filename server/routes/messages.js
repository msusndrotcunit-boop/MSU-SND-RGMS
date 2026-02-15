const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// Get all messages (admin only)
router.get('/', isAdmin, (req, res) => {
    db.all('SELECT * FROM admin_messages ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows || []);
    });
});

// Get my messages (cadet/staff)
router.get('/my', (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM admin_messages WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows || []);
    });
});

// Create a new message
router.post('/', (req, res) => {
    const { subject, message } = req.body;
    const userId = req.user.id;
    const senderRole = req.user.role;
    
    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required' });
    }
    
    const sql = 'INSERT INTO admin_messages (user_id, sender_role, subject, message, status) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [userId, senderRole, subject, message, 'pending'], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id: this.lastID, message: 'Message sent successfully' });
    });
});

// Reply to a message (admin only)
router.put('/:id/reply', isAdmin, (req, res) => {
    const { admin_reply, status } = req.body;
    const messageId = req.params.id;
    
    const sql = 'UPDATE admin_messages SET admin_reply = ?, status = ? WHERE id = ?';
    db.run(sql, [admin_reply, status || 'resolved', messageId], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Reply sent successfully' });
    });
});

// Broadcast message (admin only)
router.post('/broadcast', isAdmin, (req, res) => {
    const { subject, message, target_role } = req.body;
    
    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required' });
    }
    
    // Insert broadcast message with null user_id to indicate it's for all users
    const sql = 'INSERT INTO admin_messages (user_id, sender_role, subject, message, status) VALUES (NULL, ?, ?, ?, ?)';
    db.run(sql, ['admin', subject, message, 'broadcast'], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id: this.lastID, message: 'Broadcast sent successfully' });
    });
});

// Delete a message
router.delete('/:id', (req, res) => {
    const messageId = req.params.id;
    const userId = req.user.id;
    const isAdminUser = req.user.role === 'admin';
    
    // Admin can delete any message, users can only delete their own
    const sql = isAdminUser 
        ? 'DELETE FROM admin_messages WHERE id = ?' 
        : 'DELETE FROM admin_messages WHERE id = ? AND user_id = ?';
    const params = isAdminUser ? [messageId] : [messageId, userId];
    
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Message deleted successfully' });
    });
});

module.exports = router;
