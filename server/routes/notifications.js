const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Subscribe to push notifications
router.get('/vapid-key', authenticateToken, (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'BC0F3z4K3yN-eZ4oG296w3VzJ51WSVbze3RnebuSqaO0J2c3ORYOe1wDQCZWL7cmgEX_iq3WCmuDag8' });
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
