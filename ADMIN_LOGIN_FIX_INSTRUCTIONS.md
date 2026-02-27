# Admin Login Fix - Testing Instructions

## What Was Fixed

The JWT token validation was failing because of a secret key mismatch:
- **Problem**: JWT tokens were being signed with one key but validated with a different key
- **Root Cause**: Environment variable priority was wrong - code checked `SECRET_KEY` first, but Render uses `DJANGO_SECRET_KEY`
- **Solution**: Updated both `base.py` and `production.py` to prioritize `DJANGO_SECRET_KEY` over `SECRET_KEY`

## Changes Made

1. **Updated `production.py`**: Changed SECRET_KEY priority to check `DJANGO_SECRET_KEY` first
2. **Updated `base.py`**: Changed JWT SIGNING_KEY to use same priority order
3. **Added JWT Diagnostic Endpoint**: New endpoint to verify secret key configuration

## Testing Steps

### Step 1: Wait for Deployment
Wait for Render to complete the deployment (usually 2-3 minutes after push).

### Step 2: Check JWT Configuration
Visit this URL to verify the secret keys match:
```
https://msu-snd-rgms-1.onrender.com/api/jwt-diagnostic
```

**Expected Response:**
```json
{
  "environment_variables": {
    "SECRET_KEY": "NOT_SET",
    "DJANGO_SECRET_KEY": "your-key-h...xyz"
  },
  "django_settings": {
    "SECRET_KEY": "your-key-h...xyz",
    "JWT_SIGNING_KEY": "your-key-h...xyz"
  },
  "keys_match": true,
  "status": "OK",
  "message": "JWT signing and Django SECRET_KEY match"
}
```

**If keys_match is false**: The environment variable `DJANGO_SECRET_KEY` is not set in Render. You need to add it in Render dashboard.

### Step 3: Clear Browser Cache
**CRITICAL**: You must clear cached tokens before testing login.

**Option A - Use Incognito/Private Window** (Recommended):
- Open a new incognito/private browser window
- Go to: https://msu-snd-rgms-1.onrender.com

**Option B - Clear Browser Cache**:
- Chrome: Press `Ctrl+Shift+Delete` → Select "Cookies and other site data" → Clear
- Firefox: Press `Ctrl+Shift+Delete` → Select "Cookies" → Clear
- Edge: Press `Ctrl+Shift+Delete` → Select "Cookies and other site data" → Clear

### Step 4: Test Admin Login
1. Go to: https://msu-snd-rgms-1.onrender.com
2. Enter credentials:
   - **Username**: `msu-sndrotc_admin`
   - **Password**: `admingrading@2026`
3. Click "Login"

**Expected Result**: Login should succeed and redirect to admin dashboard.

### Step 5: Verify Token Works
After successful login, the browser should:
1. Store the JWT token in localStorage
2. Use it for subsequent API requests
3. Show your admin dashboard with data

## Troubleshooting

### If Login Still Fails with "Token is invalid"

**Check 1: Verify Secret Key Configuration**
```bash
# Visit the diagnostic endpoint
https://msu-snd-rgms-1.onrender.com/api/jwt-diagnostic
```
If `keys_match` is false, the environment variable is not set correctly.

**Check 2: Verify Admin Account Exists**
```bash
# Visit the quick check endpoint
https://msu-snd-rgms-1.onrender.com/api/quick-check
```
Should show admin user exists with correct credentials.

**Check 3: Check Render Logs**
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. Look for JWT-related errors during login attempt

**Check 4: Verify Environment Variable in Render**
1. Go to Render dashboard
2. Select your service
3. Click "Environment" tab
4. Verify `DJANGO_SECRET_KEY` exists and has a value
5. If missing, add it and redeploy

### If Login Fails with "Invalid credentials"

This means the password verification is failing:
1. Visit: https://msu-snd-rgms-1.onrender.com/api/emergency-admin
2. This will recreate the admin account with correct password hash
3. Try logging in again

### If Login Fails with "Account is locked"

The account was locked due to too many failed attempts:
1. Visit: https://msu-snd-rgms-1.onrender.com/api/unlock-admin
2. This will unlock the admin account
3. Try logging in again

## After Successful Login

Once login works successfully, you should:

1. **Remove Emergency Endpoints** (Security Risk):
   - Delete `rotc_backend/apps/system/emergency_admin.py`
   - Remove the route from `rotc_backend/apps/system/urls.py`
   - Commit and push changes

2. **Test Other Admin Functions**:
   - Navigate to different admin pages
   - Verify data loads correctly
   - Test creating/editing records

## Admin Credentials

- **Username**: `msu-sndrotc_admin`
- **Password**: `admingrading@2026`
- **Email**: `msusndrotcunit@gmail.com`
- **Role**: admin
- **User ID**: 1

## Technical Details

### JWT Token Flow
1. User submits login credentials
2. Backend authenticates using bcrypt
3. Backend creates Django User wrapper (for JWT compatibility)
4. Backend generates JWT token using `DJANGO_SECRET_KEY`
5. Frontend stores token in localStorage
6. Frontend sends token in Authorization header for API requests
7. Backend validates token using same `DJANGO_SECRET_KEY`

### Secret Key Priority (Fixed)
**Before Fix**:
```python
SECRET_KEY = os.getenv('SECRET_KEY') or os.getenv('DJANGO_SECRET_KEY', 'fallback')
JWT_SIGNING_KEY = os.environ.get('SECRET_KEY') or os.environ.get('DJANGO_SECRET_KEY', 'fallback')
```

**After Fix**:
```python
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY', 'fallback')
JWT_SIGNING_KEY = os.environ.get('DJANGO_SECRET_KEY') or os.environ.get('SECRET_KEY', 'fallback')
```

This ensures both use the same key from Render's `DJANGO_SECRET_KEY` environment variable.

## Contact

If login still fails after following all steps, provide:
1. Response from `/api/jwt-diagnostic`
2. Response from `/api/quick-check`
3. Browser console errors (F12 → Console tab)
4. Render deployment logs (last 50 lines)
