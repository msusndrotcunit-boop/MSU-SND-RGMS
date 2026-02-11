const express = require('express');
const db = require('../database');
const router = express.Router();

// Helper to serve Base64 image
const serveBase64Image = (res, imageSource) => {
    if (!imageSource) {
        return res.status(404).send('Image not found');
    }

    // Normalize potential Windows/backslash paths and relative uploads
    let src = String(imageSource);
    src = src.replace(/\\/g, '/');
    if (!src.startsWith('http') && !src.startsWith('data:')) {
        if (src.includes('uploads') && !src.startsWith('/uploads/')) {
            const parts = src.split('uploads');
            src = '/uploads/' + parts.pop().replace(/^\/+/, '');
        }
    }

    // If it's a Cloudinary URL (or any URL), redirect to it
    if (src.startsWith('http')) {
        return res.redirect(src);
    }
    
    // If it's a local path (from disk storage), redirect to static handler
    if (src.startsWith('/uploads/')) {
        // Ensure we use absolute URL if possible to avoid relative path issues on client
        const protocol = res.req.protocol || 'https';
        const host = res.req.get('host');
        if (host) {
            return res.redirect(`${protocol}://${host}${src}`);
        }
        return res.redirect(src);
    }

    if (!src.startsWith('data:image')) {
        return res.status(404).send('Image not found or invalid format');
    }

    const matches = src.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
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
