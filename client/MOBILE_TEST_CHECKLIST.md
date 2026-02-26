# Mobile App Testing Quick Checklist

## Quick Reference for Task 35.3

This checklist provides a streamlined approach to testing the Android mobile app with the Django backend.

---

## Pre-Test Setup

- [ ] Django backend running at: ________________
- [ ] Mobile app built and installed
- [ ] Test device connected (USB debugging enabled)
- [ ] Chrome DevTools configured (`chrome://inspect`)
- [ ] Test user accounts ready

---

## 1. API Compatibility (CRITICAL)

### Basic Connectivity
- [ ] App launches successfully
- [ ] Connects to Django backend
- [ ] No CORS errors in console
- [ ] HTTPS connections work

### Authentication
- [ ] Login works (admin, cadet, staff)
- [ ] JWT token received and stored
- [ ] Token persists after app restart
- [ ] Logout clears session

### CRUD Operations
- [ ] GET `/api/cadets` - List cadets
- [ ] GET `/api/cadets/:id` - Cadet detail
- [ ] GET `/api/grades/:cadet_id` - Get grades
- [ ] POST `/api/merit-demerit` - Add points
- [ ] GET `/api/notifications` - Get notifications
- [ ] POST `/api/messages/admin` - Send message

### File Uploads
- [ ] Upload profile picture from gallery
- [ ] Upload profile picture from camera
- [ ] Upload excuse letter document
- [ ] Images display correctly

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## 2. Push Notifications (HIGH)

### Setup
- [ ] `google-services.json` configured
- [ ] Notification permissions granted
- [ ] Device registered with backend

### Functionality
- [ ] Receive notification (app open)
- [ ] Receive notification (app closed)
- [ ] Tap notification opens app
- [ ] Notification badge updates
- [ ] Multiple notifications handled

### Test Scenarios
- [ ] Grade update notification
- [ ] New message notification
- [ ] Attendance notification
- [ ] System announcement

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## 3. Offline Sync (HIGH)

### Offline Detection
- [ ] Offline state detected
- [ ] User notified of offline status
- [ ] Cached data accessible

### Data Access
- [ ] View previously loaded cadets
- [ ] View previously loaded grades
- [ ] Images display from cache

### Sync on Reconnection
- [ ] Queued actions sent to server
- [ ] Data synchronized automatically
- [ ] Conflicts resolved appropriately
- [ ] No data loss

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## 4. Mobile-Specific Features (MEDIUM)

### Camera & Gallery
- [ ] Camera access works
- [ ] Gallery access works
- [ ] Photos upload successfully

### QR Code Scanning
- [ ] QR scanner opens
- [ ] QR code detected
- [ ] Attendance marked via QR

### Geolocation
- [ ] Location permission granted
- [ ] GPS coordinates captured
- [ ] Location sent to backend

### Device Permissions
- [ ] Camera permission
- [ ] Storage permission
- [ ] Location permission
- [ ] Notification permission

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## 5. Performance (MEDIUM)

### Load Times
- [ ] App launches < 3 seconds
- [ ] Cadet list loads < 2 seconds
- [ ] Images load efficiently
- [ ] No janky animations

### Resource Usage
- [ ] Memory usage stable
- [ ] Battery consumption reasonable
- [ ] Data usage optimized
- [ ] No memory leaks

### Network Conditions
- [ ] Works on 4G/LTE
- [ ] Works on 3G (slower but functional)
- [ ] Works on WiFi
- [ ] Handles network switching

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## 6. Device Compatibility (MEDIUM)

### Screen Sizes
- [ ] Small phone (< 5")
- [ ] Medium phone (5-6")
- [ ] Large phone (> 6")
- [ ] Tablet (7-10")

### Android Versions
- [ ] Android 8.0 (minimum)
- [ ] Android 10.0
- [ ] Android 11.0
- [ ] Android 12+

### Orientation
- [ ] Portrait mode works
- [ ] Landscape mode works
- [ ] Rotation smooth
- [ ] State preserved

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## 7. Real-time Updates (MEDIUM)

### WebSocket
- [ ] WebSocket connection established
- [ ] Connection stays open
- [ ] Reconnection works

### Real-time Features
- [ ] Grade updates in real-time
- [ ] Notifications in real-time
- [ ] Messages in real-time
- [ ] No duplicate messages

**Status:** ✅ Pass | ❌ Fail  
**Notes:** _______________________________________________

---

## Critical Issues Found

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Test Summary

**Test Date:** _______________  
**Tester:** _______________  
**Device:** _______________  
**Android Version:** _______________  
**Backend URL:** _______________

### Results
- API Compatibility: ⬜ Pass / ⬜ Fail
- Push Notifications: ⬜ Pass / ⬜ Fail
- Offline Sync: ⬜ Pass / ⬜ Fail
- Mobile Features: ⬜ Pass / ⬜ Fail
- Performance: ⬜ Pass / ⬜ Fail
- Device Compatibility: ⬜ Pass / ⬜ Fail
- Real-time Updates: ⬜ Pass / ⬜ Fail

### Overall Status
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Mobile app ready for production

**Approved by:** _______________  
**Date:** _______________

---

## Quick Commands

### Remote Debugging
```bash
# Connect device
adb devices

# Open Chrome DevTools
chrome://inspect

# View logs
adb logcat | grep com.msusnd.rotc.grading
```

### Testing
```bash
# Test API
node test-mobile-api.js

# Test push notifications
python test-push-notification.py

# Clear app data
adb shell pm clear com.msusnd.rotc.grading
```

### Build
```bash
# Build React app
npm run build

# Sync Capacitor
npx cap sync android

# Open Android Studio
npx cap open android
```

---

## Common Issues

### CORS Errors
- Check Django `CORS_ALLOWED_ORIGINS`
- Add `capacitor://localhost` to allowed origins
- Verify `androidScheme: 'https'` in config

### Push Notifications Not Working
- Verify `google-services.json` exists
- Check Firebase configuration
- Verify permissions granted
- Test with Firebase Console

### Offline Sync Issues
- Check localStorage implementation
- Verify service worker (if used)
- Check network detection logic
- Test sync queue implementation

---

For detailed testing procedures, see `MOBILE_APP_TESTING.md`
