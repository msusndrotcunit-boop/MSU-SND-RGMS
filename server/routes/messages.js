const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// SSE broadcast helper
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
// Helper for DB operations
const pRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const pAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const pGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// Create a message (Cadet/Staff)
router.post('/', async (req, res) => {
    const { subject, message } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required' });
    }

    try {
        await pRun(`INSERT INTO admin_messages (user_id, sender_role, subject, message) VALUES (?, ?, ?, ?)`, [userId, role, subject, message]);
        res.status(201).json({ message: 'Message sent successfully' });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ message: 'Error sending message' });
    }
});

// Get all messages (Admin only)
router.get('/', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    try {
        // We try to fetch sender details. 
        // For cadets, we link users.cadet_id -> cadets.id
        // For staff, we might need to rely on users.email matching training_staff.email if staff_id is missing in users
        
        const sql = `
            SELECT m.*, 
                   u.username, 
                   u.email as user_email,
                   c.first_name as cadet_first, c.last_name as cadet_last,
                   ts.first_name as staff_first, ts.last_name as staff_last
            FROM admin_messages m
            JOIN users u ON m.user_id = u.id
            LEFT JOIN cadets c ON u.cadet_id = c.id
            LEFT JOIN training_staff ts ON u.email = ts.email 
            WHERE m.sender_role != 'admin'
            ORDER BY m.created_at DESC
        `;
        // Note: Joining staff on email is a fallback if staff_id is not in users table.
        
        const messages = await pAll(sql);
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Get my messages (Cadet/Staff)
router.get('/my', async (req, res) => {
    const userId = req.user.id;

    try {
        const messages = await pAll(`SELECT * FROM admin_messages WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Reply/Update Status (Admin)
router.put('/:id/reply', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    const { id } = req.params;
    const { admin_reply, status } = req.body;

    try {
        await pRun(`UPDATE admin_messages SET admin_reply = ?, status = ? WHERE id = ?`, [admin_reply, status || 'resolved', id]);
        const msg = await pGet(`SELECT user_id FROM admin_messages WHERE id = ?`, [id]);
        if (msg && msg.user_id) {
            db.run('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [msg.user_id, 'Admin replied to your inquiry.', 'ask_admin_reply']);
            broadcastEvent({ type: 'ask_admin_reply', userId: msg.user_id, messageId: id });
        }
        res.json({ message: 'Reply sent successfully' });
    } catch (err) {
        console.error('Error replying to message:', err);
        res.status(500).json({ message: 'Error replying to message' });
    }
});

// Delete message (Admin auto-delete on view)
router.delete('/:id', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    const { id } = req.params;
    try {
        await pRun(`DELETE FROM admin_messages WHERE id = ?`, [id]);
        res.json({ message: 'Message deleted' });
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ message: 'Error deleting message' });
    }
});

// Broadcast message to all cadets and staff (Admin only)
router.post('/broadcast', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    const { subject, message } = req.body;
    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required' });
    }
    try {
        const recipients = await pAll(`
            SELECT id, role 
            FROM users 
            WHERE role IN ('cadet','training_staff')
              AND (is_archived IS NULL OR is_archived = 0)
              AND (
                    (role = 'cadet' AND is_approved = 1)
                    OR role = 'training_staff'
                  )
        `);
        if (!recipients || recipients.length === 0) {
            return res.status(200).json({ message: 'No eligible recipients found', count: 0, failed: 0 });
        }

        let inserted = 0;
        let failed = 0;

        // Use a transaction for efficiency; continue on per-user errors
        await pRun('BEGIN TRANSACTION');
        try {
            for (const r of recipients) {
                try {
                    await pRun(
                        `INSERT INTO admin_messages (user_id, sender_role, subject, message) VALUES (?, 'admin', ?, ?)`,
                        [r.id, String(subject).trim(), String(message).trim()]
                    );
                    await pRun(
                        `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'admin_broadcast')`,
                        [r.id, String(subject).trim()]
                    );
                    inserted++;
                } catch (e) {
                    failed++;
                }
            }
            await pRun('COMMIT');
        } catch (txErr) {
            await pRun('ROLLBACK');
            console.error('Broadcast transaction error:', txErr);
            return res.status(500).json({ message: 'Failed during broadcast transaction', count: inserted, failed });
        }
        broadcastEvent({ type: 'admin_broadcast', count: inserted });
        res.status(201).json({ message: `Broadcast sent to ${inserted} users${failed ? ` (${failed} failed)` : ''}`, count: inserted, failed });
    } catch (err) {
        console.error('Error broadcasting message:', err);
        res.status(500).json({ message: 'Error broadcasting message' });
    }
});

module.exports = router;
