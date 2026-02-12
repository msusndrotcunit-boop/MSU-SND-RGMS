# Profile Picture Loading - Debug Guide

## Changes Made (Updated)

Fixed the profile picture loading issue in **TWO** files:

### 1. `client/src/utils/image.js` - Main Fix
- Added extensive console logging to track URL construction
- Simplified URL building logic with clear case handling
- Fixed fallback endpoint to use current origin when baseURL is not set
- Better Cloudinary URL optimization

### 2. `client/src/pages/cadet/Profile.jsx` - Added Logging
- Added console logs to track which path is being used
- Now uses the fixed `getProfilePicUrl` utility function

## How to Test

1. **Rebuild the client** (important - changes won't apply without rebuild):
   ```bash
   cd client
   npm run build
   ```

2. **Restart the server**:
   ```bash
   cd server
   npm start
   ```

3. **Open browser console** (F12) and navigate to the cadet profile page

4. **Check console logs** - You should see:
   ```
   [getProfilePicUrl] Input: { rawPath: '...', cadetId: ... }
   [getProfilePicUrl] ... (processing steps)
   [Profile] Setting preview from profile_pic: https://...
   ```

## What to Look For in Console

The console will now show:
1. What data is being passed to `getProfilePicUrl`
2. Which case is being handled (Complete URL, Base64, Local path, or Fallback)
3. The final constructed URL
4. Any errors when the image fails to load

## Common Issues & Solutions

### Issue 1: Console shows "No path or cadetId provided"
**Cause**: Database has no profile_pic and cadetId is missing
**Solution**: Check if user is properly authenticated and cadetId exists

### Issue 2: Console shows correct URL but image still fails
**Cause**: Server endpoint `/api/images/cadets/{id}` is returning 404
**Solution**: 
- Check if the cadet exists in the database
- Verify the image endpoint is working: `curl https://your-domain.com/api/images/cadets/YOUR_CADET_ID`

### Issue 3: URL is constructed with wrong base
**Cause**: axios.defaults.baseURL or VITE_API_URL not set correctly
**Solution**: 
- For production: The code will use `window.location.origin` as fallback
- For development: Set `VITE_API_URL=http://localhost:5000` in `client/.env`

### Issue 4: CORS errors
**Symptom**: Browser blocks image loading from different origin
**Solution**: Check `server/server.js` has proper CORS configuration

## Testing on Production (Render)

Since you're using the deployed version at `msu-snd-rgms-jcsg.onrender.com`:

1. The changes need to be:
   - Committed to git
   - Pushed to the repository
   - Deployed to Render (automatic if connected to git)

2. Or test locally first:
   ```bash
   # In client folder
   npm run dev
   
   # In server folder (separate terminal)
   npm start
   
   # Then visit http://localhost:5173 (or whatever port Vite uses)
   ```

## Next Steps

1. **Clear browser cache** (Ctrl+Shift+Delete) or hard refresh (Ctrl+F5)
2. Open browser console (F12)
3. Navigate to cadet profile
4. **Share the console output** - this will tell us exactly what's happening

## Expected Console Output

You should see something like:
```
[getProfilePicUrl] Input: { rawPath: '/uploads/1234567890.jpg', cadetId: 5 }
[getProfilePicUrl] Local path detected
[getProfilePicUrl] Constructed URL: https://msu-snd-rgms-jcsg.onrender.com/uploads/1234567890.jpg
[Profile] Setting preview from profile_pic: https://msu-snd-rgms-jcsg.onrender.com/uploads/1234567890.jpg
```

Or if no profile pic exists:
```
[getProfilePicUrl] Input: { rawPath: null, cadetId: 5 }
[getProfilePicUrl] Using fallback endpoint for cadetId: 5
[getProfilePicUrl] Fallback URL: https://msu-snd-rgms-jcsg.onrender.com/api/images/cadets/5
[Profile] Setting preview from fallback: https://msu-snd-rgms-jcsg.onrender.com/api/images/cadets/5
```

