# Migrate Images to Cloudinary

This script migrates existing activity/announcement images from local storage to Cloudinary.

## Problem
Images uploaded before Cloudinary was configured are stored in local `/uploads/` folder. On Render's ephemeral filesystem, these files are lost after each deployment, causing images to not load.

## Solution
This script:
1. Finds all activities with local image paths
2. Uploads existing local images to Cloudinary (if they still exist)
3. Updates the database with Cloudinary URLs
4. Reports which images are missing and need manual re-upload

## Prerequisites
- Cloudinary must be configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
- Database must be accessible

## How to Run

### On Render (via Shell)
1. Go to your Render dashboard
2. Navigate to your web service
3. Click on "Shell" in the left sidebar
4. Run:
```bash
cd server
node scripts/migrate-images-to-cloudinary.js
```

### Locally
```bash
cd server
node scripts/migrate-images-to-cloudinary.js
```

## Expected Output
```
[Migration] Starting image migration to Cloudinary...
[Migration] Cloudinary is configured. Cloud name: dopd4tvvh
[Migration] Found 2 activities to process

[Migration] Processing activity #1: 25th Integration Anniversary
[Migration] WARNING: Local file not found: /opt/render/project/src/server/uploads/images-1771266020672-5857...
[Migration] This image was lost due to Render's ephemeral filesystem
[Migration] ✗ Activity #1 has missing images - needs manual re-upload

[Migration] ========== MIGRATION COMPLETE ==========
[Migration] Successfully migrated: 0
[Migration] Already on Cloudinary: 0
[Migration] Missing files (need manual re-upload): 2
[Migration] Failed: 0
[Migration] ==========================================
```

## What to Do After Running

### If images were successfully migrated:
- Images will now load correctly
- No further action needed

### If images are missing (likely on Render):
- The script will report which activities have missing images
- You need to manually re-upload images for those activities:
  1. Go to Activity Management page
  2. Click "Edit" on the activity
  3. Upload the images again
  4. Save

## Why Images Are Missing on Render
Render uses ephemeral filesystem, meaning:
- Files uploaded to `/uploads/` folder are temporary
- They are deleted when the service restarts or redeploys
- Only files in the Git repository persist

This is why Cloudinary (cloud storage) is essential for production deployments.

## Future Uploads
All new images uploaded after Cloudinary configuration will automatically go to Cloudinary and will persist correctly.
