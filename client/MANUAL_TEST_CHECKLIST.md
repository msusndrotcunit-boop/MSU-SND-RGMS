# Manual Test Checklist

## Quick Reference Guide for Manual Testing

This checklist provides a streamlined approach to manually testing the frontend integration with the Django backend. Use this for quick verification during development or before deployment.

---

## Pre-Test Setup

- [ ] Django backend running at: ________________
- [ ] React frontend running at: ________________
- [ ] Test user accounts created
- [ ] Browser DevTools open (F12)
- [ ] Network tab monitoring enabled

---

## 1. Authentication Flow (CRITICAL)

### Admin Login
- [ ] Navigate to `/login`
- [ ] Enter admin credentials
- [ ] Click "Login"
- [ ] **Verify:** Redirected to admin dashboard
- [ ] **Verify:** Token in localStorage
- [ ] **Verify:** No CORS errors in console

### Cadet Login
- [ ] Logout from admin
- [ ] Login with cadet credentials
- [ ] **Verify:** Redirected to cadet dashboard
- [ ] **Verify:** Cadet menu items visible

### Staff Login
- [ ] Logout from cadet
- [ ] Login with staff credentials
- [ ] **Verify:** Redirected to staff dashboard
- [ ] **Verify:** Staff menu items visible

### Session Persistence
- [ ] Refresh page while logged in
- [ ] **Verify:** Still logged in
- [ ] **Verify:** No re-login required

### Logout
- [ ] Click logout button
- [ ] **Verify:** Redirected to login page
- [ ] **Verify:** Token removed from localStorage
- [ ] **Verify:** Cannot access protected routes

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 2. Cadet Management (CRITICAL)

### View Cadet List
- [ ] Navigate to Cadets page
- [ ] **Verify:** Cadet list displays
- [ ] **Verify:** Profile pictures load
- [ ] **Verify:** Pagination works
- [ ] **Verify:** API call to `/api/cadets` succeeds

### Search Cadets
- [ ] Use search box
- [ ] Enter cadet name or student ID
- [ ] **Verify:** Results filtered correctly

### Filter Cadets
- [ ] Use filter dropdowns (company, platoon)
- [ ] **Verify:** Results match filter criteria

### View Cadet Detail
- [ ] Click on a cadet
- [ ] **Verify:** Detail page loads
- [ ] **Verify:** All information displayed
- [ ] **Verify:** Grades visible

### Create Cadet (Admin only)
- [ ] Click "Add Cadet"
- [ ] Fill required fields
- [ ] Submit form
- [ ] **Verify:** Success message
- [ ] **Verify:** New cadet in list

### Update Cadet
- [ ] Edit cadet information
- [ ] Save changes
- [ ] **Verify:** Changes saved
- [ ] **Verify:** Updates persist after refresh

### Archive Cadet
- [ ] Click "Archive" button
- [ ] Confirm action
- [ ] **Verify:** Cadet removed from active list
- [ ] **Verify:** Appears in archived list

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 3. Grade Management (CRITICAL)

### View Grades
- [ ] Navigate to Grades page
- [ ] **Verify:** All grade fields visible
- [ ] **Verify:** Attendance, merit, demerit points shown
- [ ] **Verify:** Exam scores displayed

### Update Exam Scores
- [ ] Edit prelim/midterm/final scores
- [ ] Save changes
- [ ] **Verify:** Scores updated
- [ ] **Verify:** Changes persist

### Add Merit Points
- [ ] Select a cadet
- [ ] Add merit points with reason
- [ ] Submit
- [ ] **Verify:** Points added to total
- [ ] **Verify:** Log entry created

### Add Demerit Points
- [ ] Select a cadet
- [ ] Add demerit points with reason
- [ ] Submit
- [ ] **Verify:** Points added to total
- [ ] **Verify:** Log entry created

### View Merit/Demerit History
- [ ] Open cadet detail
- [ ] View merit/demerit history
- [ ] **Verify:** All entries displayed
- [ ] **Verify:** Sorted by date

### Delete Merit/Demerit Entry
- [ ] Select an entry
- [ ] Click delete
- [ ] Confirm
- [ ] **Verify:** Entry removed
- [ ] **Verify:** Points adjusted

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 4. Attendance Tracking (CRITICAL)

### View Training Days
- [ ] Navigate to Attendance page
- [ ] **Verify:** Training days list displays
- [ ] **Verify:** Sorted by date

### Create Training Day
- [ ] Click "Add Training Day"
- [ ] Fill form (date, title, description)
- [ ] Submit
- [ ] **Verify:** Training day created
- [ ] **Verify:** Appears in list

### Mark Attendance
- [ ] Select a training day
- [ ] Mark cadet as present/absent/late
- [ ] Save
- [ ] **Verify:** Attendance recorded
- [ ] **Verify:** Grade count updated (if present)

### Bulk Attendance
- [ ] Click "Mark All Present"
- [ ] Confirm
- [ ] **Verify:** All cadets marked
- [ ] **Verify:** Success message

### View Attendance Records
- [ ] Select a training day
- [ ] View attendance list
- [ ] **Verify:** All records displayed
- [ ] **Verify:** Status shown correctly

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 5. Messaging & Notifications (HIGH)

### Send Admin Message (Cadet)
- [ ] Login as cadet
- [ ] Navigate to "Ask Admin"
- [ ] Compose message
- [ ] Submit
- [ ] **Verify:** Success message
- [ ] **Verify:** Message sent

### View Admin Messages (Admin)
- [ ] Login as admin
- [ ] Navigate to Messages
- [ ] **Verify:** Messages displayed
- [ ] **Verify:** Can filter by status

### Reply to Message
- [ ] Open a message
- [ ] Type reply
- [ ] Submit
- [ ] **Verify:** Reply saved
- [ ] **Verify:** Status changed to "replied"

### View Notifications
- [ ] Click notification bell
- [ ] **Verify:** Notifications displayed
- [ ] **Verify:** Unread count correct

### Mark Notification as Read
- [ ] Click a notification
- [ ] **Verify:** Marked as read
- [ ] **Verify:** Count decremented

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 6. File Uploads (HIGH)

### Upload Profile Picture
- [ ] Navigate to profile settings
- [ ] Click "Upload Profile Picture"
- [ ] Select image file
- [ ] Submit
- [ ] **Verify:** Image uploaded
- [ ] **Verify:** Profile picture updated
- [ ] **Verify:** Image displays correctly

### Upload Excuse Letter
- [ ] Navigate to Excuse Letters
- [ ] Click "Submit Excuse Letter"
- [ ] Fill form and upload document
- [ ] Submit
- [ ] **Verify:** File uploaded
- [ ] **Verify:** Excuse letter created

### Upload Activity Images
- [ ] Create/edit activity
- [ ] Upload multiple images
- [ ] Submit
- [ ] **Verify:** All images uploaded
- [ ] **Verify:** Images display in gallery

### File Validation
- [ ] Try uploading invalid file type
- [ ] **Verify:** Error message shown
- [ ] **Verify:** Upload prevented

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 7. Real-time Updates (MEDIUM)

### WebSocket Connection
- [ ] Login to application
- [ ] Open DevTools Network tab (WS filter)
- [ ] **Verify:** WebSocket connection established
- [ ] **Verify:** Connection stays open

### Real-time Grade Updates
- [ ] Open two browser windows
- [ ] Login as admin in window 1
- [ ] Login as cadet in window 2
- [ ] Update grades in window 1
- [ ] **Verify:** Window 2 updates automatically

### Real-time Notifications
- [ ] Open two browser windows
- [ ] Send message in window 1
- [ ] **Verify:** Notification appears in window 2
- [ ] **Verify:** No page refresh needed

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 8. Mobile Responsiveness (HIGH)

### Mobile Layout
- [ ] Open DevTools responsive mode
- [ ] Test at 375px width (iPhone)
- [ ] **Verify:** Layout adapts
- [ ] **Verify:** No horizontal scrolling
- [ ] **Verify:** Text readable

### Mobile Navigation
- [ ] Click hamburger menu
- [ ] **Verify:** Menu opens
- [ ] **Verify:** All items accessible
- [ ] **Verify:** Menu closes after selection

### Mobile Forms
- [ ] Fill out form on mobile
- [ ] **Verify:** Keyboard doesn't obscure fields
- [ ] **Verify:** All inputs accessible
- [ ] **Verify:** Submit button reachable

### Touch Interactions
- [ ] Test tapping buttons
- [ ] **Verify:** Touch targets large enough
- [ ] **Verify:** No accidental clicks

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 9. Error Handling (MEDIUM)

### Network Errors
- [ ] Disconnect network
- [ ] Try to perform action
- [ ] **Verify:** Error message displayed
- [ ] **Verify:** User-friendly message

### Invalid Form Data
- [ ] Submit form with invalid data
- [ ] **Verify:** Validation errors shown
- [ ] **Verify:** Invalid fields highlighted

### Session Timeout
- [ ] Wait for token expiration
- [ ] Try to perform action
- [ ] **Verify:** Redirected to login
- [ ] **Verify:** Appropriate message shown

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## 10. Browser Compatibility (MEDIUM)

### Chrome
- [ ] Test all critical features
- [ ] **Verify:** No console errors
- [ ] **Verify:** All features work

### Firefox
- [ ] Test all critical features
- [ ] **Verify:** No console errors
- [ ] **Verify:** All features work

### Safari (if available)
- [ ] Test all critical features
- [ ] **Verify:** No console errors
- [ ] **Verify:** All features work

**Status:** ✅ Pass | ❌ Fail | ⊘ Skip  
**Notes:** _______________________________________________

---

## Final Verification

### Console Checks
- [ ] No JavaScript errors
- [ ] No CORS errors
- [ ] No 404 errors for resources
- [ ] No unhandled promise rejections

### Network Checks
- [ ] All API calls succeed
- [ ] Authorization headers present
- [ ] Response formats correct
- [ ] No timeout errors

### Performance Checks
- [ ] Pages load quickly (< 3 seconds)
- [ ] No lag or freezing
- [ ] Smooth scrolling
- [ ] Images load efficiently

---

## Test Summary

**Test Date:** _______________  
**Tester:** _______________  
**Environment:** Development | Staging | Production  
**Backend URL:** _______________  
**Frontend URL:** _______________

### Results
- Total Tests: _____
- Passed: _____
- Failed: _____
- Skipped: _____
- Pass Rate: _____%

### Critical Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Recommendations
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Sign-off
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Ready for next phase

**Approved by:** _______________  
**Date:** _______________

