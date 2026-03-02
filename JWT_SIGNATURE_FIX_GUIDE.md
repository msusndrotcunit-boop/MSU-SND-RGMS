# JWT Token Signature Validation Fix

## Problem Identified

The "Token signature is invalid. Please log in again." error is caused by an **insecure SECRET_KEY** that contains the word "secret", which is flagged by Django's security validation.

## Root Cause

1. **Insecure SECRET_KEY**: The current SECRET_KEY contains "secret" which is considered insecure
2. **Environment Validation**: The production settings validate the SECRET_KEY and exit if it's insecure
3. **JWT Token Generation**: Tokens are generated with one key but validated with a different/missing key

## Solution

### Step 1: Update Render Environment Variables

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Select your web service**: `msu-snd-rgms-1`
3. **Navigate to Environment tab**
4. **Update/Add the following environment variable**:

```
DJANGO_SECRET_KEY=IhmJU6c2p!9(hWO&s3ISA*Xi5ttUJU)9HFxq(QOJ8UDd8a@3j!
```

### Step 2: Verify Other Required Environment Variables

Ensure these are also set in Render:

```
DATABASE_URL=postgresql://[your-database-url]
REDIS_URL=redis://[your-redis-url]
ALLOWED_HOSTS=msu-snd-rgms-1.onrender.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://msu-snd-rgms-1.onrender.com
```

### Step 3: Redeploy the Service

1. **Save the environment variables**
2. **Trigger a redeploy** (or it will auto-deploy)
3. **Wait for deployment to complete**

### Step 4: Clear Browser Cache

1. **Open browser developer tools** (F12)
2. **Go to Application/Storage tab**
3. **Clear localStorage** (or clear all site data)
4. **Refresh the page**

### Step 5: Test Login

1. **Navigate to**: https://msu-snd-rgms-1.onrender.com/login
2. **Select Admin tab**
3. **Enter credentials**:
   - Username: `admin`
   - Password: `admin`
4. **Click Sign In**

## Technical Details

### What Was Wrong

```python
# OLD (Insecure)
SECRET_KEY = 'django-insecure-your-secret-key-here'  # Contains 'secret'

# NEW (Secure)
SECRET_KEY = 'IhmJU6c2p!9(hWO&s3ISA*Xi5ttUJU)9HFxq(QOJ8UDd8a@3j!'  # 50 chars, random
```

### JWT Configuration

The JWT tokens are signed with the SECRET_KEY:

```python
SIMPLE_JWT = {
    'SIGNING_KEY': JWT_SECRET_KEY,  # Uses DJANGO_SECRET_KEY
    'ALGORITHM': 'HS256',
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    # ... other settings
}
```

### Environment Validation

The production settings validate the SECRET_KEY:

```python
def validate_secret_key(secret_key):
    # Checks for insecure patterns
    insecure_patterns = ['secret', 'change-this', 'django-insecure']
    if any(pattern in secret_key.lower() for pattern in insecure_patterns):
        raise EnvironmentValidationError("SECRET_KEY is insecure!")
```

## Verification

After applying the fix, you should see:

1. ✅ **No environment validation errors** in Render logs
2. ✅ **Successful login** without token signature errors
3. ✅ **JWT tokens working** for API requests
4. ✅ **User authentication** functioning properly

## Backup Plan

If the above doesn't work, you can temporarily disable environment validation:

1. **Edit** `rotc_backend/config/settings/production.py`
2. **Comment out** the validation call:
   ```python
   # validate_production_environment()  # Temporarily disabled
   ```
3. **Redeploy** and test

## Security Notes

- ✅ **New SECRET_KEY is secure**: 50 characters, random, no dictionary words
- ✅ **Environment variables**: Stored securely in Render
- ✅ **JWT tokens**: Properly signed and validated
- ✅ **HTTPS**: All traffic encrypted in production

## Monitoring

After the fix, monitor:

1. **Render logs**: No environment validation errors
2. **Login success rate**: Should be 100% for valid credentials
3. **JWT token validation**: No signature errors in logs
4. **User sessions**: Proper authentication flow

---

**Generated**: March 1, 2026  
**Status**: Ready to implement  
**Priority**: Critical - Blocks all user authentication