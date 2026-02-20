# Server Scripts

This directory contains utility scripts for database maintenance and fixes.

## Available Scripts

### fix-profile-completion.js

Fixes profile completion status for all verified cadets and staff accounts.

**What it does:**
- Sets `is_profile_completed = 1` for all cadets with `status = 'Verified'`
- Sets `is_profile_completed = 1` for all staff with complete profile information
- Displays verification statistics after the fix

**Usage:**
```bash
cd server
node scripts/fix-profile-completion.js
```

**When to use:**
- After importing cadets from ROTCMIS
- When verified accounts are being redirected to complete their profile
- After database migrations or updates

**Note:** Users will need to log out and log back in for changes to take effect in their session.

## Important: Authentication Configuration

If you're experiencing 403 errors or profile completion issues, you MUST configure authentication properly:

### For Production (Render, Heroku, etc.):

Set these environment variables in your hosting platform:

```
BYPASS_AUTH=false
API_TOKEN=dev-token
```

### For Local Development:

Create a `server/.env` file:

```env
BYPASS_AUTH=false
API_TOKEN=dev-token
NODE_ENV=development
PORT=5000
```

### Why This Matters:

- `BYPASS_AUTH=true` (default) bypasses all authentication and uses a fake admin user
- This causes 403 errors because the fake admin can't access cadet/staff endpoints
- Setting `BYPASS_AUTH=false` enables proper token-based authentication
- Users must log in with valid credentials to access their accounts

## Troubleshooting

### Issue: 403 Forbidden errors after login

**Cause:** `BYPASS_AUTH=true` on the server

**Fix:**
1. Set `BYPASS_AUTH=false` in environment variables
2. Restart the server
3. Clear browser localStorage: `localStorage.clear()`
4. Log in again

### Issue: Verified accounts asked to complete profile

**Cause:** Database has `is_profile_completed = 0` for verified accounts

**Fix:**
1. Run `node scripts/fix-profile-completion.js`
2. Users log out and log back in

### Issue: Session expired errors

**Cause:** Server restarted and in-memory sessions were cleared

**Fix:**
- Users need to log in again
- Consider implementing persistent sessions (Redis, JWT) for production
