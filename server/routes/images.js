const express = require('express');
const db = require('../database');
const router = express.Router();

// Helper to serve Base64 image
const serveBase64Image = (res, imageSource) => {
    if (!imageSource) {
        return res.status(404).send('Image not found');
    }

    // If it's a Cloudinary URL (or any URL), redirect to it
    if (imageSource.startsWith('http')) {
        return res.redirect(imageSource);
    }
    
    // If it's a local path (from old disk storage), try to redirect (or serve static if needed, but we are moving away from this)
    if (imageSource.startsWith('/uploads/')) {
        // Assuming we serve uploads statically, but ideally we should migrate these.
        // For now, let's just return 404 if file doesn't exist or let the static middleware handle it.
        // Since we don't have static middleware for /uploads in this file, we might fail.
        // But since we are moving to Cloudinary, new uploads will be URLs.
        return res.status(404).send('Legacy local file not supported in cloud mode');
    }

    if (!imageSource.startsWith('data:image')) {
        return res.status(404).send('Image not found or invalid format');
    }

    const matches = imageSource.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return res.status(500).send('Invalid image data');
    }

    const type = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });
    res.end(buffer);
};

// Get Activity Image (Legacy/Main)
router.get('/activities/:id', (req, res) => {
    db.get('SELECT image_path FROM activities WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row || !row.image_path) return res.status(404).send('Image not found');
        serveBase64Image(res, row.image_path);
    });
});

// Get Specific Activity Image (Gallery)
router.get('/activity-images/:id', (req, res) => {
    db.get('SELECT image_path FROM activity_images WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row || !row.image_path) return res.status(404).send('Image not found');
        serveBase64Image(res, row.image_path);
    });
});

// Get Cadet Profile Picture
router.get('/cadets/:id', (req, res) => {
    // Check 'cadets' table first
    db.get('SELECT profile_pic FROM cadets WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (row && row.profile_pic) {
            return serveBase64Image(res, row.profile_pic);
        }

        // Fallback to 'users' table if stored there (some versions might)
        // Or return 404/Default
        res.status(404).send('Image not found');
    });
});

// Get Staff Profile Picture
router.get('/staff/:id', (req, res) => {
    db.get('SELECT profile_pic FROM training_staff WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row || !row.profile_pic) return res.status(404).send('Image not found');
        serveBase64Image(res, row.profile_pic);
    });
});

module.exports = router;
