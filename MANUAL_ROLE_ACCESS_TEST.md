# Manual Role-Based Access Test Guide

## Overview

This guide helps you manually test that all user roles (Admin, Cadets, Training Staff) can access their respective routes and functionality.

**Target URL**: `https://msu-snd-rgms-1.onrender.com`

---

## Prerequisites

### 1. Test User Accounts

You need test accounts for each role. If you don't have them, create them first:

**Admin Account**:
- Username: `admin`
- Password: `admin123` (or your admin password)
- Role: `admin`

**Cadet Account**:
- Username: `test_cadet`
- Password: `cadet123`
- Role: `cadet`

**Training Staff Account**:
- Username: `test_staff`
- Password: `staff123`
- Role: `training_staff`

### 2. Browser Setup

- Use Chrome/Firefox with Developer Tools
- Clear cookies/localStorage before each test
- Have multiple browser tabs or incognito windows ready

---

## Test 1: Service Health Check

### ✅ Step 1.1: Basic Health Check

Open browser and navigate to:
```
https://msu-snd-rgms-1.onrender.com/api/health/
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-28T...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "celery": "running"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

**✅ PASS**: Status is "healthy" and all services are connected  
**❌ FAIL**: Any service shows as disconnected or error response

### ✅ Step 1.2: Frontend Loading

Navigate to:
```
https://msu-snd-rgms-1.onrender.com/
```

**Expected**: Login page loads correctly with no console errors

---

## Test 2: Admin Role Access

### ✅ Step 2.1: Admin Login

1. Go to `https://msu-snd-rgms-1.onrender.com/`
2. Enter admin credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Login"

**Expected**: Redirects to `/admin/cadets` or admin dashboard

### ✅ Step 2.2: Admin Navigation

Verify admin can access these pages:

**Core Admin Pages**:
- ✅ `/admin/cadets` - Cadet Management
- ✅ `/admin/staff` - Staff Management  
- ✅ `/admin/activities` - Activity Management
- ✅ `/admin/attendance` - Attendance Management
- ✅ `/admin/grading` - Grading System
- ✅ `/admin/dashboard` - Admin Dashboard
- ✅ `/admin/analytics` - Data Analysis
- ✅ `/admin/reports` - Report Generation

**System Admin Pages**:
- ✅ `/admin/performance` - Performance Monitor
- ✅ `/admin/messages` - Admin Messages
- ✅ `/settings` - System Settings

### ✅ Step 2.3: Admin API Access

Open Developer Tools → Network tab, then test these actions:

**API Endpoints to Test**:
1. **GET** `/api/v1/cadets/` - Should return cadet list
2. **GET** `/api/v1/staff/` - Should return staff list
3. **GET** `/api/v1/activities/` - Should return activities
4. **GET** `/api/v1/attendance/` - Should return attendance data
5. **GET** `/api/v1/system/status` - Should return system status

**Expected**: All return 200 OK with data

### ✅ Step 2.4: Admin Functions

Test key admin functions:

1. **Create New Cadet**: Try adding a test cadet
2. **Generate Report**: Try generating an attendance report
3. **View Analytics**: Check data analysis page loads
4. **Manage Staff**: Try viewing staff list
5. **System Settings**: Access settings page

**Expected**: All functions work without permission errors

---

## Test 3: Cadet Role Access

### ✅ Step 3.1: Cadet Login

1. **Logout** from admin account
2. Clear browser cache/localStorage
3. Go to `https://msu-snd-rgms-1.onrender.com/`
4. Enter cadet credentials:
   - Username: `test_cadet`
   - Password: `cadet123`
5. Click "Login"

**Expected**: Redirects to `/cadet/dashboard` or `/cadet/profile`

### ✅ Step 3.2: Cadet Navigation

Verify cadet can access these pages:

**Cadet Pages**:
- ✅ `/cadet/dashboard` - Cadet Dashboard
- ✅ `/cadet/profile` - Profile Management
- ✅ `/cadet/grades` - View Grades
- ✅ `/cadet/attendance` - View Attendance
- ✅ `/cadet/activities` - View Activities
- ✅ `/cadet/achievements` - View Achievements
- ✅ `/cadet/qr-code` - QR Code for attendance

### ✅ Step 3.3: Cadet Restrictions

Verify cadet **CANNOT** access admin pages:

**Should be BLOCKED** (403/401 or redirect):
- ❌ `/admin/cadets` - Should be blocked
- ❌ `/admin/staff` - Should be blocked
- ❌ `/admin/dashboard` - Should be blocked
- ❌ `/admin/analytics` - Should be blocked
- ❌ `/settings` - Should be blocked

**Test Method**: Try navigating directly to these URLs

### ✅ Step 3.4: Cadet API Access

Open Developer Tools → Network tab, then test:

**Should Work**:
1. **GET** `/api/v1/cadet/profile` - Should return cadet profile
2. **GET** `/api/v1/cadet/grades` - Should return cadet grades
3. **GET** `/api/v1/cadet/attendance` - Should return cadet attendance

**Should be BLOCKED**:
1. **GET** `/api/v1/cadets/` - Should return 403 Forbidden
2. **GET** `/api/v1/staff/` - Should return 403 Forbidden
3. **GET** `/api/v1/admin/dashboard` - Should return 403 Forbidden

---

## Test 4: Training Staff Role Access

### ✅ Step 4.1: Training Staff Login

1. **Logout** from cadet account
2. Clear browser cache/localStorage
3. Go to `https://msu-snd-rgms-1.onrender.com/`
4. Enter training staff credentials:
   - Username: `test_staff`
   - Password: `staff123`
5. Click "Login"

**Expected**: Redirects to `/staff/dashboard`

### ✅ Step 4.2: Training Staff Navigation

Verify training staff can access these pages:

**Staff Pages**:
- ✅ `/staff/dashboard` - Staff Dashboard
- ✅ `/staff/profile` - Profile Management
- ✅ `/staff/cadets` - View Assigned Cadets
- ✅ `/staff/attendance` - Mark Attendance
- ✅ `/staff/activities` - Manage Activities
- ✅ `/staff/grading` - Grade Cadets
- ✅ `/staff/communication` - Staff Communication
- ✅ `/staff/qr-code` - QR Code for attendance

### ✅ Step 4.3: Training Staff Restrictions

Verify training staff **CANNOT** access admin-only pages:

**Should be BLOCKED**:
- ❌ `/admin/analytics` - Should be blocked
- ❌ `/admin/performance` - Should be blocked
- ❌ `/settings` - Should be blocked (system settings)

**May Have LIMITED Access** (depending on role):
- ⚠️ `/admin/cadets` - May have read-only access
- ⚠️ `/admin/attendance` - May have limited access

### ✅ Step 4.4: Training Staff API Access

Open Developer Tools → Network tab, then test:

**Should Work**:
1. **GET** `/api/v1/staff/profile` - Should return staff profile
2. **GET** `/api/v1/staff/cadets` - Should return assigned cadets
3. **GET** `/api/v1/staff/attendance` - Should return attendance data

**Should be BLOCKED**:
1. **GET** `/api/v1/system/status` - Should return 403 Forbidden
2. **GET** `/api/v1/admin/analytics` - Should return 403 Forbidden

---

## Test 5: WebSocket Connections

### ✅ Step 5.1: Real-time Notifications

For each logged-in user, test WebSocket connections:

**Open Browser Console** and run:

```javascript
// Test WebSocket connection
const token = localStorage.getItem('authToken');
const ws = new WebSocket(`wss://msu-snd-rgms-1.onrender.com/ws/notifications/?token=${token}`);

ws.onopen = () => {
  console.log('✅ WebSocket connected successfully');
};

ws.onmessage = (event) => {
  console.log('📨 Message received:', JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error('❌ WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('🔌 WebSocket closed:', event.code, event.reason);
};

// Keep connection open for 10 seconds
setTimeout(() => {
  ws.close();
  console.log('🔌 WebSocket connection test completed');
}, 10000);
```

**Expected**: Connection opens successfully for all roles

---

## Test 6: Cross-Role Security

### ✅ Step 6.1: Token Hijacking Test

1. **Login as Admin** and copy the JWT token:
   - Open Developer Tools → Application → Local Storage
   - Copy the `authToken` value

2. **Login as Cadet** in another browser/incognito
3. **Replace cadet token** with admin token in localStorage
4. **Try accessing admin pages**

**Expected**: Should be blocked - tokens should be role-specific

### ✅ Step 6.2: Direct URL Access

For each role, try directly accessing other roles' URLs:

**As Cadet, try**:
- `https://msu-snd-rgms-1.onrender.com/admin/cadets`
- `https://msu-snd-rgms-1.onrender.com/staff/dashboard`

**As Training Staff, try**:
- `https://msu-snd-rgms-1.onrender.com/admin/analytics`
- `https://msu-snd-rgms-1.onrender.com/cadet/dashboard`

**Expected**: Should redirect to login or show access denied

---

## Test Results Checklist

### ✅ Service Health
- [ ] Health endpoint returns "healthy"
- [ ] Frontend loads without errors
- [ ] Database connection working
- [ ] Redis connection working

### ✅ Admin Role
- [ ] Admin can login successfully
- [ ] Admin can access all admin pages
- [ ] Admin can access system settings
- [ ] Admin API calls return data
- [ ] Admin functions work (create, edit, delete)

### ✅ Cadet Role
- [ ] Cadet can login successfully
- [ ] Cadet can access cadet pages
- [ ] Cadet CANNOT access admin pages
- [ ] Cadet CANNOT access staff pages
- [ ] Cadet API calls work for allowed endpoints
- [ ] Cadet API calls blocked for restricted endpoints

### ✅ Training Staff Role
- [ ] Staff can login successfully
- [ ] Staff can access staff pages
- [ ] Staff has appropriate admin access (if any)
- [ ] Staff CANNOT access system admin pages
- [ ] Staff API calls work for allowed endpoints
- [ ] Staff API calls blocked for restricted endpoints

### ✅ Security
- [ ] Cross-role URL access is blocked
- [ ] JWT tokens are role-specific
- [ ] WebSocket connections work for all roles
- [ ] No unauthorized access possible

### ✅ Performance
- [ ] Page load times < 3 seconds
- [ ] API response times < 1 second
- [ ] No console errors
- [ ] WebSocket connections stable

---

## Common Issues and Solutions

### Issue: Login Fails
**Symptoms**: "Invalid credentials" error
**Solutions**:
1. Verify test user accounts exist in database
2. Check password is correct
3. Verify user role is set correctly
4. Check if account is approved (`is_approved = true`)

### Issue: Pages Don't Load
**Symptoms**: 404 errors or blank pages
**Solutions**:
1. Check if Daphne is serving both HTTP and WebSocket
2. Verify frontend build is deployed
3. Check static files are served correctly
4. Verify CORS settings allow frontend domain

### Issue: API Calls Fail
**Symptoms**: 401/403 errors on API calls
**Solutions**:
1. Check JWT token is valid and not expired
2. Verify token is included in Authorization header
3. Check user has correct role permissions
4. Verify API endpoints exist and are configured

### Issue: WebSocket Fails
**Symptoms**: WebSocket connection errors
**Solutions**:
1. Verify Daphne is running (not Gunicorn)
2. Check Redis is connected for channel layer
3. Verify JWT token is valid
4. Check WebSocket URL uses `wss://` (not `ws://`)

---

## Automated Test Script

For automated testing, use the Python script:

```bash
# Install dependencies
pip install requests websocket-client

# Update test credentials in script
nano test_role_access.py

# Run automated tests
python test_role_access.py
```

The script will:
- Test all API endpoints for each role
- Verify cross-role access restrictions
- Test WebSocket connections
- Generate a detailed report

---

## Success Criteria

**✅ PASS**: All tests pass with these results:
- All roles can login and access their designated pages
- No role can access unauthorized pages/APIs
- WebSocket connections work for all roles
- No security vulnerabilities found
- Performance is acceptable (< 3s page loads)

**❌ FAIL**: Any of these issues:
- Users cannot login with correct credentials
- Roles can access unauthorized pages/APIs
- WebSocket connections fail
- Security vulnerabilities found (cross-role access)
- Performance is unacceptable (> 5s page loads)

---

**Last Updated**: 2024-02-28  
**Test Environment**: Production (`https://msu-snd-rgms-1.onrender.com`)