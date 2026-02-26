# Mobile App Compatibility Testing Guide

## Overview

This document provides comprehensive testing procedures for verifying the Android mobile app (built with Capacitor) works correctly with the Django backend. The mobile app is a Capacitor-wrapped version of the React frontend with additional mobile-specific features.

## Mobile App Architecture

**Technology Stack:**
- **Framework:** Capacitor 5.x
- **Platform:** Android (iOS support possible)
- **Base:** React 18.2.0 frontend
- **Backend:** Django REST API
- **App ID:** `com.msusnd.rotc.grading`
- **App Name:** ROTC Grading System

**Key Configuration:**
- **Server URL:** Configured in `capacitor.config.ts`
- **Android Scheme:** HTTPS
- **Mixed Content:** Allowed for development

## Prerequisites

### Development Environment Setup

1. **Android Studio** installed with Android SDK
2. **Java Development Kit (JDK)** 11 or higher
3. **Node.js** and npm installed
4. **Capacitor CLI** installed globally
5. **Android device** or emulator configured

### Build the Mobile App

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Build the React app
npm run build

# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Configure Backend URL

Update `client/capacitor.config.ts`:
```typescript
server: {
  androidScheme: 'https',
  url: 'https://rotc-django-web.onrender.com'  // Your Django backend URL
}
```


## Test Categories

### 1. API Compatibility Testing
### 2. Authentication and Authorization
### 3. Push Notifications
### 4. Offline Sync and Data Persistence
### 5. Mobile-Specific Features
### 6. Performance and Network Handling
### 7. Device Compatibility

---

## Test 1: API Compatibility Testing

### Test ID: MOBILE-API-001
**Priority:** Critical  
**Requirements:** 32.1, 32.2, 32.5

### Objective
Verify that all API endpoints work correctly from the mobile app with proper CORS configuration and response formats.

### Test Procedure

#### 1.1 Basic API Connectivity
1. Launch the mobile app
2. Open Chrome DevTools for remote debugging:
   - Connect Android device via USB
   - Open `chrome://inspect` in Chrome
   - Select your device and app
3. Monitor network requests in DevTools

**Expected Results:**
- ✅ App connects to Django backend successfully
- ✅ No CORS errors in console
- ✅ API base URL configured correctly
- ✅ HTTPS connections established

**Verification Commands:**
```javascript
// In Chrome DevTools console
console.log(window.location.origin);  // Should show app origin
console.log(localStorage.getItem('apiUrl'));  // Should show Django URL
```

#### 1.2 Authentication API
1. Navigate to login screen
2. Enter valid credentials
3. Submit login form
4. Monitor network request

**Expected Results:**
- ✅ POST request to `/api/auth/login` succeeds
- ✅ JWT token received and stored
- ✅ Authorization header set for subsequent requests
- ✅ User redirected to appropriate dashboard
- ✅ Response format matches web app expectations

**Test Data:**
```json
{
  "username": "test_cadet",
  "password": "test_password"
}
```

**Expected Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "test_cadet",
    "role": "cadet",
    "email": "cadet@example.com"
  },
  "role": "cadet"
}
```


#### 1.3 CRUD Operations
Test all major CRUD endpoints from mobile app:

**Cadet Management:**
- [ ] GET `/api/cadets` - List cadets
- [ ] GET `/api/cadets/:id` - Get cadet detail
- [ ] POST `/api/cadets` - Create cadet (admin only)
- [ ] PUT `/api/cadets/:id` - Update cadet
- [ ] DELETE `/api/cadets/:id` - Archive cadet

**Grade Management:**
- [ ] GET `/api/grades/:cadet_id` - Get grades
- [ ] PUT `/api/grades/:cadet_id` - Update grades
- [ ] POST `/api/merit-demerit` - Add merit/demerit
- [ ] GET `/api/merit-demerit/:cadet_id` - Get history

**Attendance:**
- [ ] GET `/api/training-days` - List training days
- [ ] POST `/api/attendance` - Mark attendance
- [ ] GET `/api/attendance/:training_day_id` - Get records

**Messaging:**
- [ ] GET `/api/messages/admin` - Get messages
- [ ] POST `/api/messages/admin` - Send message
- [ ] GET `/api/notifications` - Get notifications

**Expected Results for All:**
- ✅ Requests succeed with 200/201 status
- ✅ Response data structure matches web app
- ✅ Authorization headers included
- ✅ No CORS or network errors
- ✅ Data displays correctly in mobile UI

#### 1.4 File Upload from Mobile
1. Navigate to profile settings
2. Tap "Upload Profile Picture"
3. Select image from gallery or camera
4. Submit upload

**Expected Results:**
- ✅ File picker opens correctly
- ✅ Image selected successfully
- ✅ POST request to `/api/upload` with multipart/form-data
- ✅ Image uploaded to Cloudinary
- ✅ Profile picture URL returned
- ✅ Image displays in app immediately

**Test with:**
- Gallery image
- Camera photo (if device has camera)
- Different image formats (JPG, PNG)
- Various file sizes

#### 1.5 Query Parameters and Filtering
1. Navigate to cadet list
2. Apply filters (company, platoon, year level)
3. Use search functionality
4. Test pagination

**Expected Results:**
- ✅ Query parameters sent correctly
- ✅ Filtered results returned
- ✅ Search works as expected
- ✅ Pagination controls function
- ✅ URL encoding handled properly


#### 1.6 Error Handling
Test error scenarios:

1. **Network Timeout:**
   - Enable airplane mode
   - Try to perform API call
   - Verify error message

2. **Invalid Credentials:**
   - Enter wrong username/password
   - Verify error handling

3. **Server Error (500):**
   - Trigger server error (if possible)
   - Verify graceful error display

4. **Unauthorized (401):**
   - Use expired token
   - Verify redirect to login

**Expected Results:**
- ✅ User-friendly error messages displayed
- ✅ No app crashes
- ✅ Appropriate error codes handled
- ✅ Retry mechanisms work
- ✅ Offline state detected

### Test Checklist: API Compatibility
- [ ] All API endpoints accessible from mobile
- [ ] CORS configured correctly
- [ ] Authentication works
- [ ] File uploads work
- [ ] Query parameters handled
- [ ] Error handling appropriate
- [ ] Response formats compatible
- [ ] No console errors

---

## Test 2: Authentication and Authorization

### Test ID: MOBILE-AUTH-001
**Priority:** Critical  
**Requirements:** 32.4

### Objective
Verify authentication mechanisms work correctly on mobile with proper token management and session persistence.

### Test Procedure

#### 2.1 Login Flow
1. Launch app (fresh install)
2. Navigate to login screen
3. Enter credentials
4. Submit login

**Expected Results:**
- ✅ Login successful
- ✅ Token stored in device storage
- ✅ User redirected to dashboard
- ✅ Role-based navigation displayed

#### 2.2 Token Persistence
1. Login successfully
2. Close app completely
3. Reopen app
4. Verify session state

**Expected Results:**
- ✅ User remains logged in
- ✅ Token retrieved from storage
- ✅ No re-login required
- ✅ Authorization header set automatically

**Verification:**
```javascript
// Check in Chrome DevTools
localStorage.getItem('token');  // Should return JWT
localStorage.getItem('user');   // Should return user data
```


#### 2.3 Token Refresh
1. Login and wait for token to near expiration
2. Perform API call
3. Verify token refresh mechanism

**Expected Results:**
- ✅ Token refreshed automatically
- ✅ No interruption to user experience
- ✅ New token stored
- ✅ API call succeeds

#### 2.4 Logout
1. While logged in, tap logout
2. Verify logout behavior

**Expected Results:**
- ✅ Token removed from storage
- ✅ User data cleared
- ✅ Redirected to login screen
- ✅ Cannot access protected routes
- ✅ Back button doesn't return to protected pages

#### 2.5 Role-Based Access Control
Test with different user roles:

**Admin User:**
- [ ] Can access admin dashboard
- [ ] Can create/edit/delete cadets
- [ ] Can manage grades
- [ ] Can view all data

**Cadet User:**
- [ ] Can view own profile
- [ ] Can view own grades
- [ ] Cannot access admin features
- [ ] Can submit excuse letters

**Training Staff:**
- [ ] Can mark attendance
- [ ] Can view cadet lists
- [ ] Can access staff chat
- [ ] Cannot access admin-only features

**Expected Results:**
- ✅ Appropriate menu items shown per role
- ✅ Unauthorized actions blocked
- ✅ 403 errors handled gracefully
- ✅ UI adapts to user role

#### 2.6 Session Timeout
1. Login successfully
2. Leave app idle for extended period
3. Try to perform action

**Expected Results:**
- ✅ Session timeout detected
- ✅ User notified of timeout
- ✅ Redirected to login
- ✅ Can login again successfully

### Test Checklist: Authentication
- [ ] Login works correctly
- [ ] Token persists across app restarts
- [ ] Token refresh works
- [ ] Logout clears session
- [ ] Role-based access enforced
- [ ] Session timeout handled
- [ ] Biometric auth (if implemented)

---

## Test 3: Push Notifications

### Test ID: MOBILE-PUSH-001
**Priority:** High  
**Requirements:** 32.7

### Objective
Verify push notifications are received and handled correctly on Android devices.


### Prerequisites for Push Notifications

**Firebase Configuration:**
1. Ensure `google-services.json` is in `android/app/` directory
2. Firebase Cloud Messaging (FCM) configured
3. Push notification permissions granted

**Backend Configuration:**
1. Django push notification settings configured
2. VAPID keys set up (for web push)
3. FCM server key configured (for Android)

### Test Procedure

#### 3.1 Push Notification Registration
1. Login to mobile app
2. Grant notification permissions when prompted
3. Verify subscription registered

**Expected Results:**
- ✅ Permission dialog appears
- ✅ User grants permission
- ✅ POST request to `/api/push/subscribe`
- ✅ Device token registered in backend
- ✅ Subscription stored in database

**Verification:**
```bash
# Check backend database
python manage.py shell
>>> from apps.messaging.models import PushSubscription
>>> PushSubscription.objects.filter(user_id=YOUR_USER_ID)
```

#### 3.2 Receive Push Notifications
Test different notification scenarios:

**Grade Update Notification:**
1. Have admin update cadet's grades
2. Verify notification received on mobile

**New Message Notification:**
1. Have admin reply to cadet's message
2. Verify notification received

**Attendance Notification:**
1. Mark cadet as present/absent
2. Verify notification received

**Expected Results:**
- ✅ Notification appears in system tray
- ✅ Notification sound/vibration (if enabled)
- ✅ Notification title and message correct
- ✅ Notification icon displays
- ✅ Timestamp shown

#### 3.3 Notification Interaction
1. Receive a notification
2. Tap on notification
3. Verify app behavior

**Expected Results:**
- ✅ App opens to relevant screen
- ✅ Deep linking works correctly
- ✅ Notification data passed to app
- ✅ Notification marked as read
- ✅ Badge count updated

#### 3.4 Notification When App is Closed
1. Close app completely
2. Trigger notification from backend
3. Verify notification received

**Expected Results:**
- ✅ Notification received even when app closed
- ✅ Tapping notification launches app
- ✅ App navigates to correct screen
- ✅ Data loaded correctly


#### 3.5 Notification Settings
1. Navigate to app settings
2. Toggle notification preferences
3. Verify settings respected

**Expected Results:**
- ✅ Can enable/disable notifications
- ✅ Settings saved to backend
- ✅ Notifications respect user preferences
- ✅ Can configure notification types

#### 3.6 Multiple Notifications
1. Trigger multiple notifications
2. Verify notification grouping/stacking

**Expected Results:**
- ✅ Multiple notifications displayed
- ✅ Notifications grouped appropriately
- ✅ Badge count accurate
- ✅ Can dismiss individual notifications
- ✅ Can dismiss all notifications

#### 3.7 Notification Payload
Verify notification data structure:

**Expected Payload:**
```json
{
  "notification": {
    "title": "Grade Update",
    "body": "Your merit points have been updated",
    "icon": "notification_icon",
    "click_action": "FLUTTER_NOTIFICATION_CLICK"
  },
  "data": {
    "type": "grade_update",
    "cadet_id": "123",
    "route": "/grades"
  }
}
```

**Verification:**
- ✅ Title displays correctly
- ✅ Body text shows full message
- ✅ Icon renders
- ✅ Data payload accessible
- ✅ Click action works

### Test Checklist: Push Notifications
- [ ] Registration works
- [ ] Notifications received (app open)
- [ ] Notifications received (app closed)
- [ ] Notification interaction works
- [ ] Deep linking functions
- [ ] Settings respected
- [ ] Multiple notifications handled
- [ ] Payload structure correct

---

## Test 4: Offline Sync and Data Persistence

### Test ID: MOBILE-OFFLINE-001
**Priority:** High  
**Requirements:** 32.8

### Objective
Verify the app handles offline scenarios gracefully and syncs data when connection is restored.

### Test Procedure

#### 4.1 Offline Detection
1. Launch app with network connection
2. Enable airplane mode
3. Observe app behavior

**Expected Results:**
- ✅ Offline state detected
- ✅ User notified of offline status
- ✅ Offline indicator displayed
- ✅ No app crashes
- ✅ Cached data still accessible


#### 4.2 Cached Data Access
While offline, test data access:

1. **View Previously Loaded Data:**
   - Navigate to cadet list (previously loaded)
   - View cadet details
   - View grades

**Expected Results:**
- ✅ Previously loaded data displays
- ✅ Images cached and display
- ✅ No loading spinners indefinitely
- ✅ Clear indication of cached data

2. **Attempt to Load New Data:**
   - Try to load data not in cache
   - Observe error handling

**Expected Results:**
- ✅ Appropriate error message
- ✅ Retry option available
- ✅ No app crash
- ✅ User informed of offline state

#### 4.3 Offline Form Submissions
1. While offline, try to submit a form:
   - Update profile
   - Submit excuse letter
   - Send message

**Expected Results:**
- ✅ Form data saved locally
- ✅ User notified of pending sync
- ✅ Queue indicator shown
- ✅ Data not lost

#### 4.4 Data Synchronization
1. Perform actions while offline:
   - Update profile information
   - Mark items as favorites
   - Draft messages
2. Restore network connection
3. Observe sync behavior

**Expected Results:**
- ✅ Sync initiated automatically
- ✅ Queued actions sent to server
- ✅ Success/failure notifications
- ✅ Data consistency maintained
- ✅ Conflicts resolved appropriately

**Sync Scenarios to Test:**
- Profile updates
- Form submissions
- File uploads (queued)
- Message drafts
- Settings changes

#### 4.5 Conflict Resolution
1. Update data offline on mobile
2. Update same data on web app
3. Bring mobile online
4. Observe conflict handling

**Expected Results:**
- ✅ Conflict detected
- ✅ User notified of conflict
- ✅ Resolution options provided
- ✅ Data integrity maintained
- ✅ No data loss

#### 4.6 Partial Connectivity
Test with poor network conditions:

1. Enable slow 3G simulation
2. Perform various actions
3. Observe app behavior

**Expected Results:**
- ✅ Loading indicators shown
- ✅ Timeouts handled gracefully
- ✅ Retry mechanisms work
- ✅ User can cancel long operations
- ✅ App remains responsive


#### 4.7 Storage Management
1. Check app storage usage
2. Clear cache
3. Verify behavior

**Expected Results:**
- ✅ Storage usage reasonable
- ✅ Can clear cache manually
- ✅ Essential data preserved
- ✅ App functions after cache clear

**Verification:**
```bash
# Check app storage on Android
adb shell
du -sh /data/data/com.msusnd.rotc.grading/
```

### Test Checklist: Offline Sync
- [ ] Offline detection works
- [ ] Cached data accessible
- [ ] Offline forms queued
- [ ] Auto-sync on reconnection
- [ ] Conflict resolution
- [ ] Poor network handling
- [ ] Storage management
- [ ] No data loss

---

## Test 5: Mobile-Specific Features

### Test ID: MOBILE-FEATURES-001
**Priority:** Medium  
**Requirements:** 32.6, 32.9, 32.10, 32.11, 32.12

### Objective
Test mobile-specific features including camera access, geolocation, QR scanning, and device-specific functionality.

### Test Procedure

#### 5.1 Camera Access
1. Navigate to profile settings
2. Tap "Upload Profile Picture"
3. Select "Take Photo"
4. Capture photo with camera

**Expected Results:**
- ✅ Camera permission requested
- ✅ Camera opens correctly
- ✅ Photo captured successfully
- ✅ Photo preview shown
- ✅ Photo uploaded to server
- ✅ Profile picture updated

#### 5.2 Gallery Access
1. Navigate to file upload
2. Select "Choose from Gallery"
3. Select image from gallery

**Expected Results:**
- ✅ Gallery permission requested
- ✅ Gallery opens correctly
- ✅ Can browse images
- ✅ Image selected successfully
- ✅ Image uploaded correctly

#### 5.3 QR Code Scanning
1. Navigate to attendance check-in
2. Tap "Scan QR Code"
3. Scan training day QR code

**Expected Results:**
- ✅ Camera permission granted
- ✅ QR scanner opens
- ✅ QR code detected
- ✅ Code validated
- ✅ Attendance marked
- ✅ Success message shown

**Test QR Code Generation:**
```bash
# Generate test QR code
python manage.py shell
>>> from apps.attendance.models import TrainingDay
>>> td = TrainingDay.objects.first()
>>> print(f"QR Code Data: training_day_{td.id}")
```


#### 5.4 Geolocation
1. Navigate to attendance check-in
2. Allow location access
3. Submit attendance with location

**Expected Results:**
- ✅ Location permission requested
- ✅ GPS coordinates captured
- ✅ Location sent to backend
- ✅ Stored in database (last_latitude, last_longitude)
- ✅ Timestamp recorded

**Verification:**
```bash
# Check location data in backend
python manage.py shell
>>> from apps.authentication.models import User
>>> user = User.objects.get(id=YOUR_USER_ID)
>>> print(f"Location: {user.last_latitude}, {user.last_longitude}")
>>> print(f"Timestamp: {user.last_location_at}")
```

#### 5.5 File System Access
1. Navigate to excuse letter submission
2. Attach document (PDF/DOCX)
3. Submit excuse letter

**Expected Results:**
- ✅ File picker opens
- ✅ Can browse device storage
- ✅ File selected successfully
- ✅ File uploaded to Cloudinary
- ✅ Excuse letter created with file URL

#### 5.6 Device Information
Verify device info sent in requests:

**Expected Headers:**
```
User-Agent: Mozilla/5.0 (Linux; Android 11; ...) Capacitor/5.x
X-Device-Platform: android
X-App-Version: 1.0
```

**Verification:**
- ✅ Device info logged in backend
- ✅ User agent string correct
- ✅ Platform identified as mobile
- ✅ App version tracked

#### 5.7 Biometric Authentication (if implemented)
1. Enable biometric login in settings
2. Logout and login again
3. Use fingerprint/face recognition

**Expected Results:**
- ✅ Biometric prompt appears
- ✅ Authentication successful
- ✅ Token retrieved securely
- ✅ User logged in

#### 5.8 App Permissions Management
Test permission handling:

**Permissions to Test:**
- Camera
- Gallery/Storage
- Location
- Notifications
- Network state

**Expected Results:**
- ✅ Permissions requested when needed
- ✅ Clear explanation provided
- ✅ App functions without optional permissions
- ✅ Can grant permissions later
- ✅ Settings link provided if denied

### Test Checklist: Mobile Features
- [ ] Camera access works
- [ ] Gallery access works
- [ ] QR code scanning works
- [ ] Geolocation captured
- [ ] File system access works
- [ ] Device info sent correctly
- [ ] Biometric auth (if implemented)
- [ ] Permissions handled properly

---

## Test 6: Performance and Network Handling

### Test ID: MOBILE-PERF-001
**Priority:** Medium  
**Requirements:** 32.11, 32.13


### Objective
Verify app performance on mobile devices with various network conditions and optimize for mobile bandwidth.

### Test Procedure

#### 6.1 App Launch Performance
1. Close app completely
2. Launch app
3. Measure launch time

**Expected Results:**
- ✅ App launches in < 3 seconds
- ✅ Splash screen displays
- ✅ No white screen flash
- ✅ Smooth transition to main screen

**Measurement:**
```javascript
// In Chrome DevTools
performance.timing.loadEventEnd - performance.timing.navigationStart
```

#### 6.2 Page Load Performance
Test page load times:

1. **Cadet List:** < 2 seconds
2. **Cadet Detail:** < 1.5 seconds
3. **Grades Page:** < 2 seconds
4. **Attendance Page:** < 2 seconds

**Expected Results:**
- ✅ Pages load within target times
- ✅ Loading indicators shown
- ✅ Progressive rendering
- ✅ No janky animations

#### 6.3 Image Optimization
1. Load pages with images
2. Monitor image sizes
3. Check image loading

**Expected Results:**
- ✅ Images optimized for mobile
- ✅ Responsive images served
- ✅ Lazy loading implemented
- ✅ Placeholder images shown
- ✅ No oversized images

**Verification:**
```javascript
// Check image sizes in DevTools Network tab
// Profile pictures should be < 200KB
// Activity images should be < 500KB
```

#### 6.4 Network Request Optimization
1. Navigate through app
2. Monitor network requests
3. Check request sizes

**Expected Results:**
- ✅ API responses compressed (gzip)
- ✅ Minimal payload sizes
- ✅ Pagination implemented
- ✅ No unnecessary requests
- ✅ Request batching where possible

**Verification:**
```javascript
// In Chrome DevTools Network tab
// Check response headers for:
Content-Encoding: gzip
// Check response sizes
```

#### 6.5 Memory Usage
1. Use app for extended period
2. Navigate through multiple pages
3. Monitor memory usage

**Expected Results:**
- ✅ Memory usage stable
- ✅ No memory leaks
- ✅ Garbage collection working
- ✅ App doesn't slow down over time

**Measurement:**
```bash
# Check memory usage
adb shell dumpsys meminfo com.msusnd.rotc.grading
```


#### 6.6 Battery Usage
1. Use app for 30 minutes
2. Monitor battery drain
3. Check background activity

**Expected Results:**
- ✅ Reasonable battery consumption
- ✅ No excessive background activity
- ✅ Location services optimized
- ✅ Network polling efficient

#### 6.7 Network Condition Testing
Test with various network conditions:

**Test Scenarios:**
1. **4G/LTE:** Normal operation
2. **3G:** Slower but functional
3. **2G/EDGE:** Degraded but usable
4. **WiFi:** Optimal performance
5. **Switching networks:** Seamless transition

**Expected Results:**
- ✅ App adapts to network speed
- ✅ Timeouts appropriate for connection
- ✅ Retry logic works
- ✅ User informed of slow connection
- ✅ Critical features still work

**Network Simulation:**
```bash
# Use Chrome DevTools Network throttling
# Or Android Studio Network Profiler
```

#### 6.8 Data Usage
1. Monitor data consumption
2. Check for data-saving options
3. Verify efficient data usage

**Expected Results:**
- ✅ Reasonable data consumption
- ✅ Images compressed
- ✅ API responses minimal
- ✅ No redundant requests
- ✅ Data-saving mode available (optional)

**Measurement:**
```bash
# Check data usage
adb shell dumpsys netstats | grep com.msusnd.rotc.grading
```

### Test Checklist: Performance
- [ ] Fast app launch
- [ ] Quick page loads
- [ ] Images optimized
- [ ] Network requests efficient
- [ ] Memory usage stable
- [ ] Battery consumption reasonable
- [ ] Works on various networks
- [ ] Data usage optimized

---

## Test 7: Device Compatibility

### Test ID: MOBILE-COMPAT-001
**Priority:** Medium  
**Requirements:** 32.1, 32.14

### Objective
Verify app works correctly across different Android devices, OS versions, and screen sizes.

### Test Devices

**Minimum Test Matrix:**
1. **Low-end device:** Android 8.0, 2GB RAM, 720p screen
2. **Mid-range device:** Android 10.0, 4GB RAM, 1080p screen
3. **High-end device:** Android 12+, 6GB+ RAM, 1440p screen
4. **Tablet:** Android 10+, 10" screen

### Test Procedure

#### 7.1 Screen Size Compatibility
Test on various screen sizes:

**Phone Sizes:**
- Small (< 5"): 320x568
- Medium (5-6"): 375x667, 414x896
- Large (> 6"): 428x926

**Tablet Sizes:**
- 7" tablet: 600x960
- 10" tablet: 800x1280


**Expected Results:**
- ✅ Layout adapts to screen size
- ✅ No content cut off
- ✅ Touch targets appropriately sized
- ✅ Text readable without zooming
- ✅ Images scale correctly
- ✅ Navigation accessible

#### 7.2 Android Version Compatibility
Test on different Android versions:

**Priority Versions:**
- Android 8.0 (Oreo) - Minimum supported
- Android 10.0 - Common version
- Android 11.0 - Recent version
- Android 12+ - Latest version

**Expected Results:**
- ✅ App installs successfully
- ✅ All features work
- ✅ No crashes
- ✅ UI renders correctly
- ✅ Permissions handled properly

#### 7.3 Orientation Changes
1. Use app in portrait mode
2. Rotate to landscape
3. Rotate back to portrait

**Expected Results:**
- ✅ Layout adapts smoothly
- ✅ No data loss
- ✅ State preserved
- ✅ No crashes
- ✅ UI elements reposition correctly

#### 7.4 Multi-tasking
1. Open app
2. Switch to another app
3. Return to ROTC app

**Expected Results:**
- ✅ App state preserved
- ✅ No data loss
- ✅ Session maintained
- ✅ Resumes smoothly

#### 7.5 Background/Foreground Transitions
1. Use app normally
2. Press home button (background)
3. Wait 5 minutes
4. Reopen app

**Expected Results:**
- ✅ App resumes correctly
- ✅ Session still valid
- ✅ Data refreshed if needed
- ✅ No crashes

#### 7.6 Low Memory Conditions
1. Open multiple apps
2. Fill device memory
3. Use ROTC app

**Expected Results:**
- ✅ App handles low memory gracefully
- ✅ No crashes
- ✅ Appropriate warnings shown
- ✅ Can clear cache to free memory

#### 7.7 Different Manufacturers
Test on devices from various manufacturers:

- Samsung
- Google Pixel
- Xiaomi
- OnePlus
- Huawei (if available)

**Expected Results:**
- ✅ Consistent behavior across manufacturers
- ✅ No manufacturer-specific bugs
- ✅ UI renders correctly
- ✅ All features work

### Test Checklist: Device Compatibility
- [ ] Works on various screen sizes
- [ ] Compatible with Android 8.0+
- [ ] Handles orientation changes
- [ ] Multi-tasking works
- [ ] Background/foreground transitions smooth
- [ ] Low memory handling
- [ ] Works on different manufacturers

---

## Test 8: Real-time Updates (WebSocket)

### Test ID: MOBILE-WS-001
**Priority:** Medium  
**Requirements:** 32.15


### Objective
Verify WebSocket connections work correctly on mobile for real-time updates.

### Test Procedure

#### 8.1 WebSocket Connection
1. Login to mobile app
2. Check WebSocket connection in Chrome DevTools

**Expected Results:**
- ✅ WebSocket connection established
- ✅ Connection URL correct
- ✅ Authentication token included
- ✅ Connection stays open
- ✅ Heartbeat messages sent

**Verification:**
```javascript
// In Chrome DevTools Console
// Check WebSocket connection
// Should see: ws://your-backend/ws/updates/?token=...
```

#### 8.2 Real-time Grade Updates
1. Open mobile app (logged in as cadet)
2. Have admin update grades on web app
3. Observe mobile app

**Expected Results:**
- ✅ Grade update received via WebSocket
- ✅ UI updates automatically
- ✅ No page refresh needed
- ✅ Update animation smooth

#### 8.3 Real-time Notifications
1. Open mobile app
2. Trigger notification from backend
3. Observe notification badge

**Expected Results:**
- ✅ Notification received in real-time
- ✅ Badge count updates
- ✅ Notification appears in list
- ✅ Sound/vibration (if enabled)

#### 8.4 WebSocket Reconnection
1. Establish WebSocket connection
2. Enable airplane mode briefly
3. Disable airplane mode
4. Observe reconnection

**Expected Results:**
- ✅ Disconnection detected
- ✅ Automatic reconnection attempted
- ✅ Connection re-established
- ✅ Missed messages retrieved
- ✅ User notified of connection status

#### 8.5 Background WebSocket Handling
1. Establish WebSocket connection
2. Put app in background
3. Wait 2 minutes
4. Bring app to foreground

**Expected Results:**
- ✅ Connection maintained or reconnected
- ✅ Updates received while backgrounded
- ✅ UI syncs when foregrounded
- ✅ No duplicate messages

### Test Checklist: Real-time Updates
- [ ] WebSocket connects successfully
- [ ] Real-time updates received
- [ ] Reconnection works
- [ ] Background handling correct
- [ ] No message loss
- [ ] Performance acceptable

---

## Debugging and Troubleshooting

### Remote Debugging Setup

**Chrome DevTools for Android:**
1. Enable USB debugging on Android device
2. Connect device via USB
3. Open Chrome and navigate to `chrome://inspect`
4. Select your device and app
5. Click "Inspect" to open DevTools

**View Console Logs:**
```bash
# View Android logs
adb logcat | grep -i "chromium\|capacitor\|rotc"

# View app-specific logs
adb logcat | grep com.msusnd.rotc.grading
```


### Common Issues and Solutions

#### Issue 1: CORS Errors
**Symptoms:** API requests fail with CORS errors

**Solutions:**
1. Verify Django CORS settings include mobile app origin
2. Check `capacitor.config.ts` server URL
3. Ensure `androidScheme: 'https'` is set
4. Verify backend `CORS_ALLOWED_ORIGINS` includes Capacitor origin

**Django Settings:**
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://your-frontend.com',
    'capacitor://localhost',  # Add this for Capacitor
    'http://localhost',       # Add this for Capacitor
]
```

#### Issue 2: Authentication Token Not Persisting
**Symptoms:** User logged out after app restart

**Solutions:**
1. Check localStorage implementation
2. Verify Capacitor Storage plugin installed
3. Use Capacitor Preferences API for persistent storage
4. Check token expiration time

**Code Fix:**
```typescript
import { Preferences } from '@capacitor/preferences';

// Save token
await Preferences.set({ key: 'token', value: token });

// Retrieve token
const { value } = await Preferences.get({ key: 'token' });
```

#### Issue 3: Push Notifications Not Working
**Symptoms:** No notifications received

**Solutions:**
1. Verify `google-services.json` in `android/app/`
2. Check Firebase configuration
3. Verify notification permissions granted
4. Check backend push notification setup
5. Test with Firebase Console

**Debug Commands:**
```bash
# Check if google-services.json exists
ls -la android/app/google-services.json

# View notification logs
adb logcat | grep -i "fcm\|notification"
```

#### Issue 4: File Uploads Failing
**Symptoms:** Images/documents not uploading

**Solutions:**
1. Check file permissions
2. Verify Cloudinary configuration
3. Check file size limits
4. Verify multipart/form-data format
5. Check network connectivity

**Debug:**
```javascript
// In Chrome DevTools, check request headers
Content-Type: multipart/form-data; boundary=...
```

#### Issue 5: WebSocket Connection Fails
**Symptoms:** Real-time updates not working

**Solutions:**
1. Verify WebSocket URL in config
2. Check Django Channels configuration
3. Verify Redis connection
4. Check authentication token in WebSocket URL
5. Test WebSocket endpoint directly

**Test WebSocket:**
```bash
# Test WebSocket connection
wscat -c "ws://your-backend/ws/updates/?token=YOUR_TOKEN"
```

#### Issue 6: App Crashes on Startup
**Symptoms:** App crashes immediately after launch

**Solutions:**
1. Check Android logs for stack trace
2. Verify all Capacitor plugins installed
3. Check for JavaScript errors
4. Verify build configuration
5. Clear app data and cache

**Debug Commands:**
```bash
# View crash logs
adb logcat | grep -i "crash\|exception\|error"

# Clear app data
adb shell pm clear com.msusnd.rotc.grading
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Django backend running and accessible
- [ ] Mobile app built and installed
- [ ] Test user accounts created
- [ ] Test data populated
- [ ] Chrome DevTools configured for remote debugging
- [ ] Network monitoring tools ready

### Critical Tests (Must Pass)
- [ ] API Compatibility (Test 1)
- [ ] Authentication (Test 2)
- [ ] Basic CRUD operations work
- [ ] File uploads work
- [ ] App doesn't crash

### High Priority Tests (Should Pass)
- [ ] Push Notifications (Test 3)
- [ ] Offline Sync (Test 4)
- [ ] Mobile-specific features (Test 5)
- [ ] Performance acceptable (Test 6)

### Medium Priority Tests (Nice to Have)
- [ ] Device Compatibility (Test 7)
- [ ] Real-time Updates (Test 8)
- [ ] Advanced offline features
- [ ] Biometric authentication


### Test Results Template

**Test Date:** _______________  
**Tester:** _______________  
**Device:** _______________  
**Android Version:** _______________  
**App Version:** _______________  
**Backend URL:** _______________

#### Test Results Summary

| Test Category | Status | Pass Rate | Notes |
|--------------|--------|-----------|-------|
| API Compatibility | ⬜ Pass / ⬜ Fail | __/__ | |
| Authentication | ⬜ Pass / ⬜ Fail | __/__ | |
| Push Notifications | ⬜ Pass / ⬜ Fail | __/__ | |
| Offline Sync | ⬜ Pass / ⬜ Fail | __/__ | |
| Mobile Features | ⬜ Pass / ⬜ Fail | __/__ | |
| Performance | ⬜ Pass / ⬜ Fail | __/__ | |
| Device Compatibility | ⬜ Pass / ⬜ Fail | __/__ | |
| Real-time Updates | ⬜ Pass / ⬜ Fail | __/__ | |

#### Critical Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

#### Known Limitations
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

#### Recommendations
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

#### Sign-off
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Mobile app ready for production

**Approved by:** _______________  
**Date:** _______________

---

## Automated Testing Scripts

### Test Script 1: API Connectivity Test

Create `test-mobile-api.js`:
```javascript
// Test mobile app API connectivity
const axios = require('axios');

const API_URL = 'https://rotc-django-web.onrender.com';
const TEST_USER = {
  username: 'test_cadet',
  password: 'test_password'
};

async function testMobileAPI() {
  console.log('Testing Mobile App API Connectivity...\n');
  
  try {
    // Test 1: Login
    console.log('1. Testing Login...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Test 2: Get Profile
    console.log('\n2. Testing Get Profile...');
    const profileResponse = await axios.get(`${API_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile retrieved');
    console.log(`   User: ${profileResponse.data.username}`);
    
    // Test 3: Get Cadets
    console.log('\n3. Testing Get Cadets...');
    const cadetsResponse = await axios.get(`${API_URL}/api/cadets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Cadets retrieved');
    console.log(`   Count: ${cadetsResponse.data.data.length}`);
    
    // Test 4: Get Notifications
    console.log('\n4. Testing Get Notifications...');
    const notificationsResponse = await axios.get(`${API_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Notifications retrieved');
    console.log(`   Count: ${notificationsResponse.data.length}`);
    
    console.log('\n✅ All API tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testMobileAPI();
```

Run with:
```bash
node test-mobile-api.js
```


### Test Script 2: Push Notification Test

Create `test-push-notification.py`:
```python
#!/usr/bin/env python
"""
Test push notification delivery to mobile devices
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.messaging.tasks import send_push_notification
from apps.authentication.models import User

def test_push_notification():
    print("Testing Push Notification Delivery...\n")
    
    # Get test user
    user = User.objects.filter(role='cadet').first()
    if not user:
        print("❌ No cadet user found")
        return
    
    print(f"Sending push notification to user: {user.username}")
    
    # Send test notification
    result = send_push_notification.apply_async(
        args=[
            user.id,
            "Test Notification",
            "This is a test notification from the Django backend",
            {"type": "test", "timestamp": "2024-01-01T00:00:00Z"}
        ]
    )
    
    print(f"✅ Push notification task queued")
    print(f"   Task ID: {result.id}")
    print(f"   User ID: {user.id}")
    print("\nCheck your mobile device for the notification!")

if __name__ == '__main__':
    test_push_notification()
```

Run with:
```bash
cd rotc_backend
python test-push-notification.py
```

---

## Configuration Files

### Capacitor Configuration

**File:** `client/capacitor.config.ts`
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.msusnd.rotc.grading',
  appName: 'ROTC Grading System',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.MOBILE_SERVER_URL || 'https://rotc-django-web.onrender.com',
    cleartext: false
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true  // Enable for development only
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1976d2',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#ffffff'
    }
  }
};

export default config;
```

### Android Build Configuration

**File:** `client/android/app/build.gradle`
```groovy
android {
    defaultConfig {
        applicationId "com.msusnd.rotc.grading"
        minSdkVersion 22
        targetSdkVersion 33
        versionCode 1
        versionName "1.0.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
        debug {
            debuggable true
        }
    }
}
```

### Environment Variables

**File:** `client/.env.mobile`
```bash
# Mobile App Environment Variables
VITE_API_URL=https://rotc-django-web.onrender.com
VITE_WS_URL=wss://rotc-django-channels.onrender.com
MOBILE_SERVER_URL=https://rotc-django-web.onrender.com
VITE_APP_NAME=ROTC Grading System
VITE_APP_VERSION=1.0.0
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passed
- [ ] Backend URL configured correctly
- [ ] Push notifications configured
- [ ] App icons and splash screens added
- [ ] App permissions documented
- [ ] Privacy policy added
- [ ] Terms of service added

### Build Configuration
- [ ] Release build created
- [ ] ProGuard rules configured
- [ ] Code signing configured
- [ ] Version number updated
- [ ] Build tested on real devices

### Store Preparation
- [ ] App screenshots prepared
- [ ] App description written
- [ ] Feature graphic created
- [ ] Privacy policy URL provided
- [ ] Support email configured

### Post-Deployment
- [ ] Monitor crash reports
- [ ] Monitor user feedback
- [ ] Track API usage
- [ ] Monitor push notification delivery
- [ ] Update documentation

---

## Appendix

### Useful Commands

**Build and Deploy:**
```bash
# Build React app
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Run on device
npx cap run android

# Build release APK
cd android
./gradlew assembleRelease
```

**Debugging:**
```bash
# View logs
adb logcat

# View app logs only
adb logcat | grep com.msusnd.rotc.grading

# Clear app data
adb shell pm clear com.msusnd.rotc.grading

# Uninstall app
adb uninstall com.msusnd.rotc.grading

# Install APK
adb install app-release.apk
```

**Testing:**
```bash
# Run automated tests
npm run test:mobile

# Test API connectivity
node test-mobile-api.js

# Test push notifications
python test-push-notification.py
```

### Resources

**Documentation:**
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

**Tools:**
- Chrome DevTools for remote debugging
- Android Studio for development
- Firebase Console for push notifications
- Postman for API testing

---

## Conclusion

This comprehensive testing guide covers all aspects of mobile app compatibility with the Django backend. Follow the test procedures systematically to ensure the Android app works correctly with all features including API compatibility, authentication, push notifications, offline sync, and mobile-specific functionality.

**Key Success Criteria:**
- ✅ All API endpoints accessible from mobile
- ✅ Authentication and authorization working
- ✅ Push notifications delivered successfully
- ✅ Offline sync functioning correctly
- ✅ Mobile-specific features operational
- ✅ Performance acceptable on target devices
- ✅ No critical bugs or crashes

For questions or issues, refer to the troubleshooting section or contact the development team.
