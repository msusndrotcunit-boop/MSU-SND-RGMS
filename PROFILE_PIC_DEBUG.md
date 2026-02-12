# Profile Picture Loading - Debug Guide

## Changes Made

Fixed the profile picture loading issue in `client/src/pages/cadet/Profile.jsx`:

1. **Simplified URL Construction**: Cleaned up the complex URL building logic
2. **Better Cloudinary Support**: Properly handles Cloudinary URLs with auto-optimization
3. **Improved Error Handling**: Added console logging to see which URLs are failing
4. **Fixed Fallback Logic**: Ensures fallback endpoint uses correct base URL

## How to Test

1. **Start the server**:
   ```bash
   cd server
   npm start
   ```

2. **Start the client** (in a new terminal):
   ```bash
   cd client
   npm run dev
   ```

3. **Open browser console** (F12) and navigate to the cadet profile page

4. **Check console logs**:
   - Look for "Profile picture failed to load:" messages
   - This will show you the exact URL that's failing

## Common Issues & Solutions

### Issue 1: Image URL is wrong
**Symptom**: Console shows incorrect URL format
**Solution**: Check what's stored in the database:
```bash
cd server
node -e "const db = require('./database'); db.get('SELECT id, first_name, profile_pic FROM cadets WHERE id = YOUR_CADET_ID', (err, row) => { console.log(row); });"
```

### Issue 2: Server not serving images
**Symptom**: 404 errors in console
**Solution**: 
- Check if `/uploads` folder exists in `server/` directory
- Verify images are in the correct location
- Check server logs for errors

### Issue 3: Cloudinary images not loading
**Symptom**: Cloudinary URLs return errors
**Solution**:
- Check `.env` file has correct Cloudinary credentials
- Verify Cloudinary account is active
- Check if URLs in database are valid

### Issue 4: CORS errors
**Symptom**: Browser blocks image loading
**Solution**: Check `server/server.js` has proper CORS configuration

## Database Check

To see what's actually stored in the database:

```bash
cd server
# If using SQLite
sqlite3 rotc.db "SELECT id, first_name, last_name, profile_pic FROM cadets LIMIT 5;"

# Or use the debug script
node -e "const db = require('./database'); db.all('SELECT id, first_name, profile_pic FROM cadets LIMIT 5', (err, rows) => { console.log(JSON.stringify(rows, null, 2)); });"
```

## Expected URL Formats

The code now handles these formats:

1. **Cloudinary**: `https://res.cloudinary.com/...`
2. **Local uploads**: `/uploads/1234567890.jpg`
3. **Base64**: `data:image/jpeg;base64,...`
4. **Fallback endpoint**: `/api/images/cadets/123`

## Next Steps

1. Open browser console (F12)
2. Navigate to cadet profile
3. Look for error messages
4. Share the console output if issue persists
