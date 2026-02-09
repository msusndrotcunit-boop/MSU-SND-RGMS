const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Subscribe to push notifications
router.get('/vapid-key', authenticateToken, (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'BC0F3z4K3yN-eZ4oG296w3VzJ51WSVbze3RnebuSqaO0J2c3ORYOe1wDQCZWL7cmgEX_iq3WCmuDag8' });
});

// GET /api/notifications - Fetch notifications for the current user
router.get('/', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const role = req.user.role;

    let sql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`;
    let params = [userId];

    if (role === 'admin') {
        // Admin sees their own AND global (user_id IS NULL)
        sql = `SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC`;
        params = [userId];
    } else if (role === 'training_staff') {
        // Staff sees their own AND global announcements/activities (if we filter by type later)
        // For now, just their own + NULL (if NULL is used for all-staff announcements)
        sql = `SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC`;
        params = [userId];
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// DELETE /api/notifications/:id - Delete notification (Mark as handled/read/removed)
router.delete('/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;

    db.get(`SELECT * FROM notifications WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Notification not found' });

        // Allow delete if it belongs to user OR if it's global (NULL) and user is admin
        // Also allow admin to delete any notification? No, stick to scope.
        // If row.user_id is NULL, any admin can delete it (removes for all admins)
        // If row.user_id is NULL, staff/cadet should probably not delete it? 
        // But user said "After viewing... it will be automatically deleted".
        // If a cadet deletes a global notification, it disappears for everyone? That's bad if it's "Announcement".
        // But here we are talking about "Login alerts" and "Messages".
        // Login alerts are for Admin (NULL). So Admin deletes them.
        // Ask Admin replies are for Cadet (user_id). Cadet deletes them.
        
        if (row.user_id !== userId && row.user_id !== null && role !== 'admin') {
             return res.status(403).json({ message: 'Unauthorized' });
        }
        
        db.run(`DELETE FROM notifications WHERE id = ?`, [id], (err) => {
             if (err) return res.status(500).json({ message: err.message });
             res.json({ message: 'Notification deleted' });
        });
    });
});

router.post('/subscribe', authenticateToken, (req, res) => {
    const subscription = req.body;
    const userId = req.user.userId;

    const payload = JSON.stringify(subscription);
    
    // Check if subscription already exists
    db.get('SELECT * FROM push_subscriptions WHERE endpoint = ?', [subscription.endpoint], (err, row) => {
        if (err) {
            console.error('Error checking subscription:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (row) {
            // Update user_id if changed (e.g., login with different user)
            if (row.user_id !== userId) {
                db.run('UPDATE push_subscriptions SET user_id = ? WHERE id = ?', [userId, row.id], (err) => {
                    if (err) console.error('Error updating subscription user:', err);
                });
            }
            return res.status(200).json({ message: 'Subscription already exists' });
        }

        db.run('INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES (?, ?, ?)', 
            [userId, subscription.endpoint, JSON.stringify(subscription.keys)], 
            (err) => {
                if (err) {
                    console.error('Error saving subscription:', err);
                    return res.status(500).json({ error: 'Failed to save subscription' });
                }
                res.status(201).json({ message: 'Subscribed successfully' });
            }
        );
    });
});

// Unsubscribe
router.post('/unsubscribe', authenticateToken, (req, res) => {
    const { endpoint } = req.body;
    db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint], (err) => {
        if (err) {
            console.error('Error deleting subscription:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json({ message: 'Unsubscribed successfully' });
    });
});

module.exports = router;
