# Render Deployment 502 Gateway Error - Diagnostics & Fixes

## Problem
App is showing 502 Gateway error on Render (https://msu-snd-rgms-jcsg.onrender.com)

##Root Causes & Solutions

### 1. **Build Command Optimization** (IMPLEMENTED)
**Issue**: Build might be timing out on Render's free tier
```javascript
// OLD (could timeout):
"start": "cd server && node server.js"

// NEW (more reliable):
"start": "node server/server.js"
```
- Changed to direct server execution instead of cd + node
- Server now listens on ALL interfaces (0.0.0.0) before DB init
- Improved startup diagnostics with prestart script

### 2. **Check Environment Variables on Render**
Navigate to your Render service > Environment > ensure these are set:
```
- NODE_ENV=production (optional, defaults to development)
- REDIRECT_ENABLED=true
- PORT (auto-set by Render, defaults to 10000)
```

### 3. **Database Issues**
The server uses SQLite by default, which should work out-of-box. If using Postgres:
- Set `DATABASE_URL` or `SUPABASE_URL` environment variable
- Server will auto-detect and use PostgreSQL

### 4. **Manual Restart on Render**
1. Go to your Render dashboard
2. Find "rotc-grading-system" service
3. Click "Manual Deploy" > "Deploy latest commit"
4. Check the deploy logs for errors

### 5. **Check Build Output**
Render might be showing logs. Look for:
- ✅ If you see "✓ built in X.XXs" → build succeeded
- ❌ If build fails → check for missing dependencies or syntax errors

###6. **Local Testing**
Run locally to verify everything works:
```bash
npm install
npm run build
npm start
# Should see: "Server successfully started on port XXXX"
```

### 7. **Common Issues & Fixes**

#### Issue: Port binding error
**Solution**: Render auto-sets PORT env var. Server correctly uses it.

#### Issue: "Client build not found"
**Solution**: 
- Ensure `npm run build` in client completes
- dist/index.html should exist after build

#### Issue: Database connection error
**Solution**:
- SQLite uses local file by default (no setup needed)
- Render's free tier has ephemeral storage, so DB resets on redeploy
- For persistent DB, add PostgreSQL add-on

### 8. **Recent Changes**
- ✅ Added auto-deploy GitHub Actions workflow
- ✅ Fixed startup script to use direct path
- ✅ Added prestart diagnostics
- ✅ Improved error logging

### 9. **Next Steps**
1. Push changes to GitHub (done: commit 6ed3260)
2. Render auto-deploys (2-5 minutes)
3. Monitor health: https://msu-snd-rgms-jcsg.onrender.com/health
4. If still 502, check Render logs for specific errors

### 10. **Health Check Endpoints**
- `/health` - Basic health check (returns "OK")
- `/api/health` - Detailed health check (DB status, etc.)
- `/api/cloudinary/status` - Image serving status

## References
- Server main file: `server/server.js`
- Build config: `client/vite.config.js`
- Root scripts: `package.json`
- Render config: `render.yaml`
