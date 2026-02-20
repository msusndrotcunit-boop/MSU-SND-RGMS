const db = require('../database');
const { cloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const path = require('path');
const fs = require('fs');

console.log('[Migration] Starting image migration to Cloudinary...');

if (!isCloudinaryConfigured) {
    console.error('[Migration] ERROR: Cloudinary is not configured!');
    console.error('[Migration] Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    process.exit(1);
}

console.log('[Migration] Cloudinary is configured. Cloud name:', cloudinary.config().cloud_name);

// Get all activities from database
db.all('SELECT id, title, image_path, images FROM activities', [], async (err, activities) => {
    if (err) {
        console.error('[Migration] Database error:', err);
        process.exit(1);
    }

    console.log(`[Migration] Found ${activities.length} activities to process`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    let missingCount = 0;

    for (const activity of activities) {
        console.log(`\n[Migration] Processing activity #${activity.id}: ${activity.title}`);
        
        let images = [];
        try {
            if (activity.images) {
                images = JSON.parse(activity.images);
            }
        } catch (e) {
            console.log(`[Migration] Could not parse images JSON for activity #${activity.id}`);
        }

        // Check if images are already Cloudinary URLs
        const allCloudinary = images.every(img => 
            img && (img.startsWith('http://res.cloudinary.com') || img.startsWith('https://res.cloudinary.com'))
        );

        if (allCloudinary && images.length > 0) {
            console.log(`[Migration] Activity #${activity.id} already uses Cloudinary URLs. Skipping.`);
            skipCount++;
            continue;
        }

        // Process local images
        const newImages = [];
        let hasFailures = false;
        let hasMissing = false;

        for (const imgPath of images) {
            // Skip if already a Cloudinary URL
            if (imgPath && (imgPath.startsWith('http://res.cloudinary.com') || imgPath.startsWith('https://res.cloudinary.com'))) {
                newImages.push(imgPath);
                continue;
            }

            // Skip data URLs
            if (imgPath && imgPath.startsWith('data:')) {
                console.log(`[Migration] Skipping data URL (too large to migrate)`);
                continue;
            }

            // Handle local paths
            if (imgPath && imgPath.startsWith('/uploads/')) {
                const filename = path.basename(imgPath);
                const localPath = path.join(__dirname, '../uploads', filename);

                // Check if file exists
                if (!fs.existsSync(localPath)) {
                    console.log(`[Migration] WARNING: Local file not found: ${localPath}`);
                    console.log(`[Migration] This image was lost due to Render's ephemeral filesystem`);
                    hasMissing = true;
                    continue;
                }

                // Upload to Cloudinary
                try {
                    console.log(`[Migration] Uploading ${filename} to Cloudinary...`);
                    const result = await cloudinary.uploader.upload(localPath, {
                        folder: 'rotc-grading-system',
                        resource_type: 'auto'
                    });
                    console.log(`[Migration] Successfully uploaded to: ${result.secure_url}`);
                    newImages.push(result.secure_url);
                } catch (uploadErr) {
                    console.error(`[Migration] Failed to upload ${filename}:`, uploadErr.message);
                    hasFailures = true;
                }
            }
        }

        // Update database if we have new images
        if (newImages.length > 0) {
            const newImagesJson = JSON.stringify(newImages);
            const primaryImage = newImages[0];

            db.run(
                'UPDATE activities SET image_path = ?, images = ? WHERE id = ?',
                [primaryImage, newImagesJson, activity.id],
                (updateErr) => {
                    if (updateErr) {
                        console.error(`[Migration] Failed to update activity #${activity.id}:`, updateErr);
                        failCount++;
                    } else {
                        console.log(`[Migration] ✓ Updated activity #${activity.id} with ${newImages.length} Cloudinary URLs`);
                        successCount++;
                    }
                }
            );
        } else if (hasMissing) {
            console.log(`[Migration] ✗ Activity #${activity.id} has missing images - needs manual re-upload`);
            missingCount++;
        } else if (hasFailures) {
            console.log(`[Migration] ✗ Activity #${activity.id} had upload failures`);
            failCount++;
        }
    }

    // Wait a bit for all database updates to complete
    setTimeout(() => {
        console.log('\n[Migration] ========== MIGRATION COMPLETE ==========');
        console.log(`[Migration] Successfully migrated: ${successCount}`);
        console.log(`[Migration] Already on Cloudinary: ${skipCount}`);
        console.log(`[Migration] Missing files (need manual re-upload): ${missingCount}`);
        console.log(`[Migration] Failed: ${failCount}`);
        console.log('[Migration] ==========================================\n');
        
        if (missingCount > 0) {
            console.log('[Migration] NOTE: Some activities have missing images due to Render\'s ephemeral filesystem.');
            console.log('[Migration] These activities will show placeholder icons until you manually re-upload the images.');
        }
        
        process.exit(0);
    }, 2000);
});
