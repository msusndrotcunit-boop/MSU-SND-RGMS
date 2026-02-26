# Frontend Integration Test Documentation

## Overview

This document provides comprehensive integration test procedures for verifying the React frontend works correctly with the Django backend. These tests cover all major features including authentication, cadet management, grading, attendance tracking, messaging, file uploads, and real-time updates.

## Test Environment Setup

### Prerequisites

1. **Django Backend Running**
   - Local: `http://localhost:8000`
   - Production: `https://rotc-django-web.onrender.com`

2. **React Frontend Running**
   - Local: `http://localhost:5173` (Vite dev server)
   - Production: Deployed frontend URL

3. **Test Data**
   - Admin user credentials
   - Cadet user credentials
   - Training staff credentials
   - Sample cadet records
   - Sample training days

### Environment Configuration

Ensure the correct environment file is being used:

**For Local Testing:**
```bash
# .env.development should contain:
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

**For Production Testing:**
```bash
# .env.production should contain:
VITE_API_URL=https://rotc-django-web.onrender.com
VITE_WS_URL=wss://rotc-django-channels.onrender.com
```

## Test Categories

1. Authentication & Authorization
2. Cadet Management
3. Grade Management
4. Attendance Tracking
5. Messaging & Notifications
6. File Uploads
7. Real-time Updates
8. Cross-browser Compatibility
9. Mobile Responsiveness
10. Performance & Error Handling


## Test 1: User Login and Authentication Flow

### Test ID: AUTH-001
**Priority:** Critical  
**Requirements:** 34.1, 34.4

### Test Procedure

#### 1.1 Admin Login
1. Navigate to login page (`/login`)
2. Enter admin credentials:
   - Username: `admin` (or your admin username)
   - Password: `[admin password]`
3. Click "Login" button

**Expected Results:**
- ✅ Login request sent to `/api/auth/login`
- ✅ Response contains JWT token
- ✅ Token stored in localStorage with key `token`
- ✅ Authorization header set: `Bearer <token>`
- ✅ User redirected to admin dashboard
- ✅ No CORS errors in console
- ✅ User profile data loaded correctly

**Verification Steps:**
```javascript
// Open browser DevTools Console and run:
localStorage.getItem('token')  // Should return JWT token
axios.defaults.headers.common['Authorization']  // Should show Bearer token
```

#### 1.2 Cadet Login
1. Logout from admin account
2. Navigate to login page
3. Enter cadet credentials
4. Click "Login" button

**Expected Results:**
- ✅ Successful login
- ✅ Redirected to cadet dashboard
- ✅ Cadet-specific menu items visible
- ✅ Admin features not accessible

#### 1.3 Training Staff Login
1. Logout from cadet account
2. Navigate to login page
3. Enter training staff credentials
4. Click "Login" button

**Expected Results:**
- ✅ Successful login
- ✅ Redirected to staff dashboard
- ✅ Staff-specific menu items visible

#### 1.4 Invalid Credentials
1. Navigate to login page
2. Enter invalid credentials
3. Click "Login" button

**Expected Results:**
- ✅ Error message displayed
- ✅ User remains on login page
- ✅ No token stored
- ✅ Appropriate error message shown

#### 1.5 Token Persistence
1. Login successfully
2. Refresh the page
3. Navigate to different pages

**Expected Results:**
- ✅ User remains logged in after refresh
- ✅ Token persists in localStorage
- ✅ Authorization header maintained
- ✅ No re-login required

#### 1.6 Logout
1. While logged in, click logout button
2. Verify logout behavior

**Expected Results:**
- ✅ Token removed from localStorage
- ✅ Authorization header cleared
- ✅ Redirected to login page
- ✅ Cannot access protected routes

### Test Data Requirements
- Valid admin credentials
- Valid cadet credentials
- Valid staff credentials
- Invalid credentials for negative testing

### Browser DevTools Checklist
- [ ] Network tab shows successful POST to `/api/auth/login`
- [ ] Response status: 200 OK
- [ ] Response contains `token` field
- [ ] No CORS errors in console
- [ ] Authorization header present in subsequent requests


## Test 2: Cadet List and Detail Views

### Test ID: CADET-001
**Priority:** Critical  
**Requirements:** 34.5, 34.6

### Test Procedure

#### 2.1 View Cadet List (Admin)
1. Login as admin
2. Navigate to Cadets page
3. Observe cadet list display

**Expected Results:**
- ✅ GET request to `/api/cadets`
- ✅ Cadet list displays with all columns
- ✅ Pagination controls visible
- ✅ Search functionality available
- ✅ Filter options available (company, platoon, year level)
- ✅ Profile pictures load correctly
- ✅ Data matches backend records

**Verification:**
```javascript
// Check API response in Network tab
// Response should have structure:
{
  "data": [...],
  "page": 1,
  "limit": 50,
  "total": 100
}
```

#### 2.2 Search Cadets
1. In cadet list, use search box
2. Enter cadet name or student ID
3. Observe filtered results

**Expected Results:**
- ✅ Search query sent to backend
- ✅ Results filtered correctly
- ✅ Only matching cadets displayed
- ✅ Clear search button works

#### 2.3 Filter Cadets
1. Use filter dropdowns (company, platoon, year level)
2. Select filter options
3. Observe filtered results

**Expected Results:**
- ✅ Filter parameters sent in API request
- ✅ Results match filter criteria
- ✅ Multiple filters work together
- ✅ Clear filters button works

#### 2.4 View Cadet Detail
1. Click on a cadet from the list
2. View cadet detail page

**Expected Results:**
- ✅ GET request to `/api/cadets/:id`
- ✅ All cadet information displayed
- ✅ Profile picture loads
- ✅ Associated grades displayed
- ✅ Personal information visible
- ✅ Contact information visible
- ✅ ROTC-specific fields visible

#### 2.5 Create New Cadet (Admin)
1. Click "Add Cadet" button
2. Fill in required fields:
   - Student ID
   - First Name
   - Last Name
   - Company
   - Platoon
3. Submit form

**Expected Results:**
- ✅ POST request to `/api/cadets`
- ✅ Success message displayed
- ✅ New cadet appears in list
- ✅ Grades record auto-created
- ✅ Redirected to cadet detail or list

#### 2.6 Update Cadet Information
1. Open cadet detail page
2. Click "Edit" button
3. Modify cadet information
4. Save changes

**Expected Results:**
- ✅ PUT request to `/api/cadets/:id`
- ✅ Success message displayed
- ✅ Changes reflected immediately
- ✅ Updated data persists after refresh

#### 2.7 Archive Cadet (Soft Delete)
1. Open cadet detail page
2. Click "Archive" button
3. Confirm action

**Expected Results:**
- ✅ DELETE request to `/api/cadets/:id`
- ✅ Cadet removed from active list
- ✅ Cadet appears in archived list
- ✅ Can be restored later

#### 2.8 View Archived Cadets
1. Navigate to archived cadets section
2. View archived cadet list

**Expected Results:**
- ✅ GET request to `/api/cadets/archived`
- ✅ Only archived cadets displayed
- ✅ Restore option available

#### 2.9 Restore Archived Cadet
1. In archived list, select a cadet
2. Click "Restore" button
3. Confirm action

**Expected Results:**
- ✅ POST request to `/api/cadets/:id/restore`
- ✅ Cadet removed from archived list
- ✅ Cadet appears in active list

### Test Data Requirements
- At least 10 sample cadets
- Cadets in different companies and platoons
- Some archived cadets

### Browser DevTools Checklist
- [ ] Network tab shows correct API endpoints
- [ ] Response data structure matches expectations
- [ ] No JavaScript errors in console
- [ ] Images load correctly (check for 404s)


## Test 3: Grade Management Features

### Test ID: GRADE-001
**Priority:** Critical  
**Requirements:** 34.7

### Test Procedure

#### 3.1 View Cadet Grades
1. Login as admin
2. Navigate to Grades page or cadet detail
3. View grade information

**Expected Results:**
- ✅ GET request to `/api/grades` or `/api/grades/:cadet_id`
- ✅ All grade fields displayed:
  - Attendance Present
  - Merit Points
  - Demerit Points
  - Prelim Score
  - Midterm Score
  - Final Score
- ✅ Grade calculations correct
- ✅ Associated cadet information visible

#### 3.2 Update Exam Scores
1. Open grade edit form
2. Update prelim/midterm/final scores
3. Save changes

**Expected Results:**
- ✅ PUT request to `/api/grades/:cadet_id`
- ✅ Success message displayed
- ✅ Updated scores visible immediately
- ✅ Changes persist after refresh

#### 3.3 Add Merit Points
1. Navigate to merit/demerit management
2. Select a cadet
3. Add merit points with reason
4. Submit

**Expected Results:**
- ✅ POST request to `/api/merit-demerit`
- ✅ Request body contains:
  ```json
  {
    "cadet_id": 1,
    "type": "merit",
    "points": 10,
    "reason": "Outstanding performance",
    "issued_by_user_id": 1
  }
  ```
- ✅ Merit points added to cadet's total
- ✅ Log entry created
- ✅ Grade updated automatically

#### 3.4 Add Demerit Points
1. Navigate to merit/demerit management
2. Select a cadet
3. Add demerit points with reason
4. Submit

**Expected Results:**
- ✅ POST request to `/api/merit-demerit`
- ✅ Demerit points added to cadet's total
- ✅ Log entry created
- ✅ Grade updated automatically

#### 3.5 View Merit/Demerit History
1. Open cadet detail page
2. Navigate to merit/demerit history tab
3. View log entries

**Expected Results:**
- ✅ GET request to `/api/merit-demerit/:cadet_id`
- ✅ All log entries displayed
- ✅ Shows: date, type, points, reason, issued by
- ✅ Sorted by date (most recent first)

#### 3.6 Delete Merit/Demerit Log Entry
1. In merit/demerit history, select an entry
2. Click delete button
3. Confirm deletion

**Expected Results:**
- ✅ DELETE request to `/api/merit-demerit/:id`
- ✅ Entry removed from list
- ✅ Grade totals updated automatically
- ✅ Points subtracted from cadet's total

#### 3.7 Bulk Grade Update
1. Navigate to bulk grade update (if available)
2. Select multiple cadets
3. Update a common field
4. Submit

**Expected Results:**
- ✅ Multiple PUT requests or single bulk request
- ✅ All selected cadets updated
- ✅ Success message for each update
- ✅ Changes reflected in grade list

#### 3.8 Grade Validation
1. Try to enter invalid grade values:
   - Negative numbers
   - Non-numeric values
   - Values outside valid range
2. Submit form

**Expected Results:**
- ✅ Client-side validation prevents submission
- ✅ Error messages displayed
- ✅ Form highlights invalid fields
- ✅ Backend validation as fallback

### Test Data Requirements
- Cadets with existing grades
- Various merit/demerit log entries
- Test data for validation scenarios

### Browser DevTools Checklist
- [ ] Network tab shows correct grade API calls
- [ ] Response includes updated grade totals
- [ ] No calculation errors in console
- [ ] Real-time updates work (if implemented)


## Test 4: Attendance Tracking Features

### Test ID: ATTEND-001
**Priority:** Critical  
**Requirements:** 34.8

### Test Procedure

#### 4.1 View Training Days
1. Login as admin or staff
2. Navigate to Attendance page
3. View training days list

**Expected Results:**
- ✅ GET request to `/api/training-days`
- ✅ Training days displayed in chronological order
- ✅ Shows: date, title, description, location
- ✅ Pagination works correctly

#### 4.2 Create Training Day
1. Click "Add Training Day" button
2. Fill in form:
   - Date
   - Title
   - Description
   - Location
3. Submit

**Expected Results:**
- ✅ POST request to `/api/training-days`
- ✅ Success message displayed
- ✅ New training day appears in list
- ✅ Can be selected for attendance tracking

#### 4.3 Update Training Day
1. Select a training day
2. Click "Edit" button
3. Modify information
4. Save changes

**Expected Results:**
- ✅ PUT request to `/api/training-days/:id`
- ✅ Changes saved successfully
- ✅ Updated information displayed

#### 4.4 Delete Training Day
1. Select a training day
2. Click "Delete" button
3. Confirm deletion

**Expected Results:**
- ✅ DELETE request to `/api/training-days/:id`
- ✅ Training day removed from list
- ✅ Associated attendance records handled appropriately

#### 4.5 Mark Cadet Attendance
1. Select a training day
2. View cadet attendance list
3. Mark individual cadet as present/absent/late/excused
4. Save

**Expected Results:**
- ✅ POST or PUT request to `/api/attendance`
- ✅ Request body contains:
  ```json
  {
    "training_day_id": 1,
    "cadet_id": 1,
    "status": "present",
    "time_in": "08:00:00"
  }
  ```
- ✅ Attendance status updated
- ✅ Grade attendance count updated (if present)

#### 4.6 Bulk Attendance Marking
1. Select a training day
2. Click "Mark All Present" or similar bulk action
3. Confirm action

**Expected Results:**
- ✅ POST request to `/api/attendance/bulk`
- ✅ All cadets marked with selected status
- ✅ Success message displayed
- ✅ Attendance list updated

#### 4.7 View Attendance Records
1. Select a training day
2. View attendance records for that day

**Expected Results:**
- ✅ GET request to `/api/attendance/:training_day_id`
- ✅ All attendance records displayed
- ✅ Shows: cadet name, status, time in, time out
- ✅ Can filter by status

#### 4.8 Update Attendance Status
1. In attendance list, select a record
2. Change status (e.g., from absent to excused)
3. Save changes

**Expected Results:**
- ✅ PUT request to `/api/attendance/:id`
- ✅ Status updated successfully
- ✅ Grade count adjusted if needed

#### 4.9 QR Code Check-in (if implemented)
1. Generate QR code for training day
2. Scan QR code with mobile device
3. Submit check-in

**Expected Results:**
- ✅ POST request to `/api/attendance/qr-checkin`
- ✅ Attendance marked automatically
- ✅ Success message displayed
- ✅ Time recorded accurately

#### 4.10 Staff Attendance
1. Navigate to staff attendance section
2. Mark staff attendance for training day
3. Save

**Expected Results:**
- ✅ POST request to `/api/staff-attendance`
- ✅ Staff attendance recorded
- ✅ Time in/out tracked

#### 4.11 Attendance Reports
1. Navigate to attendance reports
2. Select date range
3. Generate report

**Expected Results:**
- ✅ Report displays attendance statistics
- ✅ Shows: total present, absent, late, excused
- ✅ Can export to PDF/Excel (if implemented)

### Test Data Requirements
- Multiple training days
- Cadets with various attendance statuses
- Staff members for staff attendance

### Browser DevTools Checklist
- [ ] Network tab shows attendance API calls
- [ ] Unique constraint violations handled gracefully
- [ ] Status validation works correctly
- [ ] Grade updates trigger properly


## Test 5: Messaging and Notifications

### Test ID: MSG-001
**Priority:** High  
**Requirements:** 34.9

### Test Procedure

#### 5.1 Send Admin Message (Cadet)
1. Login as cadet
2. Navigate to "Ask Admin" or Messages page
3. Compose message:
   - Subject
   - Message body
4. Submit

**Expected Results:**
- ✅ POST request to `/api/messages/admin`
- ✅ Request body contains:
  ```json
  {
    "subject": "Question about grades",
    "message": "I have a question..."
  }
  ```
- ✅ Success message displayed
- ✅ Message appears in sent messages
- ✅ Notification created for admin

#### 5.2 View Admin Messages (Admin)
1. Login as admin
2. Navigate to Messages page
3. View incoming messages

**Expected Results:**
- ✅ GET request to `/api/messages/admin`
- ✅ All messages displayed
- ✅ Shows: sender, subject, message, status, date
- ✅ Can filter by status (pending, replied)
- ✅ Unread messages highlighted

#### 5.3 Reply to Admin Message
1. As admin, open a message
2. Type reply in reply field
3. Submit reply

**Expected Results:**
- ✅ PUT request to `/api/messages/admin/:id`
- ✅ Request body contains:
  ```json
  {
    "admin_reply": "Thank you for your question...",
    "status": "replied"
  }
  ```
- ✅ Reply saved successfully
- ✅ Status changed to "replied"
- ✅ Notification sent to original sender

#### 5.4 Staff Chat Messages
1. Login as training staff
2. Navigate to Staff Chat
3. Send a message
4. View messages from other staff

**Expected Results:**
- ✅ POST request to `/api/messages/staff`
- ✅ Message appears in chat
- ✅ Real-time updates (if WebSocket enabled)
- ✅ Messages sorted chronologically

#### 5.5 View Notifications
1. Click notification bell icon
2. View notification dropdown

**Expected Results:**
- ✅ GET request to `/api/notifications`
- ✅ Notifications displayed
- ✅ Shows: message, type, date, read status
- ✅ Unread count badge visible
- ✅ Sorted by date (newest first)

#### 5.6 Mark Notification as Read
1. Click on a notification
2. Observe read status change

**Expected Results:**
- ✅ PUT request to `/api/notifications/:id/read`
- ✅ Notification marked as read
- ✅ Unread count decremented
- ✅ Visual indicator updated

#### 5.7 Delete Notification
1. In notification list, click delete
2. Confirm deletion

**Expected Results:**
- ✅ DELETE request to `/api/notifications/:id`
- ✅ Notification removed from list
- ✅ Count updated

#### 5.8 Notification Count
1. Observe notification badge
2. Verify count accuracy

**Expected Results:**
- ✅ GET request to `/api/notifications/unread/count`
- ✅ Badge shows correct unread count
- ✅ Updates when notifications read/deleted

#### 5.9 Push Notifications (if enabled)
1. Enable push notifications in settings
2. Trigger a notification event
3. Observe push notification

**Expected Results:**
- ✅ POST request to `/api/push/subscribe`
- ✅ Push subscription registered
- ✅ Push notification received
- ✅ Clicking notification opens app

#### 5.10 Notification Filtering
1. Navigate to notifications page
2. Filter by type or read status
3. View filtered results

**Expected Results:**
- ✅ Filter parameters sent in API request
- ✅ Only matching notifications displayed
- ✅ Clear filters works

### Test Data Requirements
- Multiple admin messages
- Staff chat messages
- Various notification types
- Read and unread notifications

### Browser DevTools Checklist
- [ ] Network tab shows message API calls
- [ ] WebSocket connection established (if enabled)
- [ ] Notification count updates correctly
- [ ] No duplicate notifications


## Test 6: File Uploads

### Test ID: FILE-001
**Priority:** High  
**Requirements:** 34.11

### Test Procedure

#### 6.1 Upload Profile Picture (Cadet)
1. Login as cadet
2. Navigate to profile settings
3. Click "Upload Profile Picture"
4. Select an image file (JPG, PNG)
5. Submit

**Expected Results:**
- ✅ POST request to `/api/upload`
- ✅ Request is multipart/form-data
- ✅ Request contains:
  - `file`: image file
  - `type`: "profile_pic"
  - `entity_id`: cadet ID
- ✅ Response contains Cloudinary URL
- ✅ Profile picture updated immediately
- ✅ Image displays correctly
- ✅ URL saved to database

**Verification:**
```javascript
// Check response structure:
{
  "url": "https://res.cloudinary.com/...",
  "public_id": "...",
  "format": "jpg"
}
```

#### 6.2 Upload Profile Picture (Staff)
1. Login as training staff
2. Navigate to profile settings
3. Upload profile picture
4. Submit

**Expected Results:**
- ✅ Same as 6.1 but for staff profile
- ✅ Staff profile picture updated

#### 6.3 Upload Excuse Letter Document
1. Login as cadet
2. Navigate to Excuse Letters
3. Click "Submit Excuse Letter"
4. Fill in form:
   - Date absent
   - Reason
   - Upload document (PDF, DOCX, or image)
5. Submit

**Expected Results:**
- ✅ POST request to `/api/upload` for file
- ✅ POST request to `/api/excuse-letters` for excuse letter
- ✅ File uploaded to Cloudinary
- ✅ Excuse letter created with file URL
- ✅ Success message displayed
- ✅ Excuse letter appears in list

#### 6.4 Upload Activity Images
1. Login as admin
2. Navigate to Activities
3. Create or edit an activity
4. Upload multiple images
5. Submit

**Expected Results:**
- ✅ Multiple POST requests to `/api/upload`
- ✅ All images uploaded successfully
- ✅ Activity created/updated with image URLs
- ✅ Images display in activity detail
- ✅ Image gallery works correctly

#### 6.5 File Type Validation
1. Try to upload invalid file types:
   - Executable files (.exe)
   - Script files (.js, .sh)
   - Very large files (>10MB)
2. Observe validation

**Expected Results:**
- ✅ Client-side validation prevents upload
- ✅ Error message displayed
- ✅ Accepted file types shown
- ✅ Backend validation as fallback

#### 6.6 File Size Validation
1. Try to upload a very large file
2. Observe validation

**Expected Results:**
- ✅ File size checked before upload
- ✅ Error message if too large
- ✅ Maximum size displayed
- ✅ Upload prevented

#### 6.7 Image Compression
1. Upload a large image file
2. Observe compression behavior

**Expected Results:**
- ✅ Image compressed before upload (if implemented)
- ✅ Upload completes successfully
- ✅ Image quality acceptable
- ✅ File size reduced

#### 6.8 Delete Uploaded File
1. Navigate to profile or activity with uploaded image
2. Click delete/remove image button
3. Confirm deletion

**Expected Results:**
- ✅ DELETE request to `/api/upload/:public_id`
- ✅ File removed from Cloudinary
- ✅ Database reference removed
- ✅ Image no longer displays

#### 6.9 View Uploaded Files
1. Navigate to pages with uploaded files
2. Verify images load correctly

**Expected Results:**
- ✅ All images load from Cloudinary
- ✅ No broken image links
- ✅ Images display at appropriate sizes
- ✅ Loading indicators shown

#### 6.10 Upload Progress Indicator
1. Upload a moderately large file
2. Observe upload progress

**Expected Results:**
- ✅ Progress bar or indicator shown
- ✅ Percentage or status displayed
- ✅ Can cancel upload (if implemented)
- ✅ Success message after completion

### Test Data Requirements
- Various image files (JPG, PNG, different sizes)
- PDF documents
- DOCX documents
- Invalid file types for testing

### Browser DevTools Checklist
- [ ] Network tab shows multipart/form-data requests
- [ ] Response contains Cloudinary URLs
- [ ] No CORS errors for Cloudinary
- [ ] Images load with correct MIME types
- [ ] Check for 404 errors on image URLs


## Test 7: Real-time Updates via WebSocket

### Test ID: REALTIME-001
**Priority:** Medium  
**Requirements:** 34.11

### Test Procedure

#### 7.1 WebSocket Connection Establishment
1. Login to the application
2. Open browser DevTools Network tab
3. Filter by WS (WebSocket)
4. Observe WebSocket connection

**Expected Results:**
- ✅ WebSocket connection to `/ws/updates/`
- ✅ Connection URL includes authentication token
- ✅ Connection status: 101 Switching Protocols
- ✅ Connection remains open
- ✅ Heartbeat/ping messages (if implemented)

**Verification:**
```javascript
// In browser console, check WebSocket:
// Look for WebSocket connection in Network tab (WS filter)
// Connection URL should be: ws://localhost:8000/ws/updates/?token=<jwt>
```

#### 7.2 Real-time Grade Updates
1. Open two browser windows/tabs
2. Login as admin in window 1
3. Login as cadet in window 2
4. In window 1, update the cadet's grades
5. Observe window 2

**Expected Results:**
- ✅ Grade update in window 1 successful
- ✅ WebSocket message sent from backend
- ✅ Window 2 receives update message
- ✅ Grade display updates automatically in window 2
- ✅ No page refresh required

**Message Format:**
```json
{
  "type": "grade_update",
  "data": {
    "cadet_id": 1,
    "grades": {
      "merit_points": 50,
      "demerit_points": 5,
      "attendance_present": 20
    }
  }
}
```

#### 7.3 Real-time Merit/Demerit Updates
1. Open two browser windows
2. Login as admin in window 1
3. Login as cadet in window 2
4. In window 1, add merit/demerit points
5. Observe window 2

**Expected Results:**
- ✅ Merit/demerit added successfully
- ✅ WebSocket message received
- ✅ Points update in real-time
- ✅ Merit/demerit log updates

#### 7.4 Real-time Notification Updates
1. Open two browser windows
2. Login as admin in window 1
3. Login as cadet in window 2
4. In window 1, send a message to the cadet
5. Observe window 2

**Expected Results:**
- ✅ Message sent successfully
- ✅ Notification created
- ✅ WebSocket message received in window 2
- ✅ Notification badge updates
- ✅ Notification appears in dropdown
- ✅ Sound/visual alert (if implemented)

#### 7.5 Real-time Message Updates
1. Open two browser windows
2. Login as staff member 1 in window 1
3. Login as staff member 2 in window 2
4. Send staff chat message from window 1
5. Observe window 2

**Expected Results:**
- ✅ Message sent successfully
- ✅ WebSocket message received
- ✅ Message appears in chat immediately
- ✅ No polling required

#### 7.6 WebSocket Reconnection
1. Establish WebSocket connection
2. Simulate network interruption:
   - Disable network briefly
   - Or close WebSocket in DevTools
3. Re-enable network
4. Observe reconnection

**Expected Results:**
- ✅ Connection lost detected
- ✅ Automatic reconnection attempted
- ✅ Connection re-established
- ✅ Missed messages retrieved (if implemented)
- ✅ User notified of connection status

#### 7.7 WebSocket Authentication
1. Try to connect to WebSocket without token
2. Observe authentication failure

**Expected Results:**
- ✅ Connection rejected without valid token
- ✅ Error message or connection closed
- ✅ No unauthorized access

#### 7.8 Multiple Tab Synchronization
1. Open 3+ tabs with same user
2. Perform actions in one tab
3. Observe updates in all tabs

**Expected Results:**
- ✅ All tabs receive WebSocket messages
- ✅ All tabs update simultaneously
- ✅ No conflicts or race conditions

#### 7.9 Fallback to Polling (if WebSocket fails)
1. Block WebSocket connections (browser extension or firewall)
2. Observe fallback behavior

**Expected Results:**
- ✅ Application detects WebSocket failure
- ✅ Falls back to HTTP polling
- ✅ Updates still work (slower)
- ✅ User experience degraded but functional

### Test Data Requirements
- Multiple user accounts for testing
- Test data that triggers real-time updates

### Browser DevTools Checklist
- [ ] Network tab shows WebSocket connection (WS filter)
- [ ] WebSocket frames show messages
- [ ] Connection stays open (not constantly reconnecting)
- [ ] No authentication errors
- [ ] Message format matches expectations

### Notes
- If WebSocket is not implemented, verify SSE (Server-Sent Events) or polling
- Check for memory leaks with long-running connections
- Test on different browsers (Chrome, Firefox, Safari)


## Test 8: Cross-Browser Compatibility

### Test ID: BROWSER-001
**Priority:** Medium

### Browsers to Test
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Safari (latest, macOS/iOS)
- Microsoft Edge (latest)
- Mobile browsers (Chrome Mobile, Safari Mobile)

### Test Procedure

#### 8.1 Basic Functionality (All Browsers)
Test the following in each browser:

1. **Login/Authentication**
   - ✅ Login works
   - ✅ Token stored correctly
   - ✅ Session persists

2. **Navigation**
   - ✅ All menu items work
   - ✅ Routing functions correctly
   - ✅ Back/forward buttons work

3. **Forms**
   - ✅ Input fields work
   - ✅ Dropdowns function
   - ✅ Date pickers work
   - ✅ File uploads work
   - ✅ Form validation works

4. **Data Display**
   - ✅ Tables render correctly
   - ✅ Images load
   - ✅ Charts display (if used)
   - ✅ Pagination works

5. **API Calls**
   - ✅ All CRUD operations work
   - ✅ No CORS errors
   - ✅ Error handling works

#### 8.2 Browser-Specific Issues

**Safari-Specific:**
- ✅ Date input format compatibility
- ✅ LocalStorage works
- ✅ Fetch API works
- ✅ WebSocket connections (if used)

**Firefox-Specific:**
- ✅ File upload dialogs work
- ✅ CSS rendering correct
- ✅ JavaScript features supported

**Edge-Specific:**
- ✅ All modern features work
- ✅ No legacy IE issues

#### 8.3 Console Errors
For each browser:
- [ ] Open DevTools Console
- [ ] Navigate through all pages
- [ ] Check for JavaScript errors
- [ ] Check for deprecation warnings

### Browser DevTools Checklist
- [ ] No console errors in any browser
- [ ] Network requests succeed in all browsers
- [ ] LocalStorage accessible in all browsers
- [ ] CSS renders consistently


## Test 9: Mobile Responsiveness

### Test ID: MOBILE-001
**Priority:** High

### Devices to Test
- iPhone (Safari)
- Android phone (Chrome)
- iPad/Tablet
- Various screen sizes (use DevTools responsive mode)

### Test Procedure

#### 9.1 Responsive Layout
1. Open application on mobile device or DevTools responsive mode
2. Test various screen sizes:
   - 320px (small phone)
   - 375px (iPhone)
   - 414px (large phone)
   - 768px (tablet)
   - 1024px (desktop)

**Expected Results:**
- ✅ Layout adapts to screen size
- ✅ No horizontal scrolling
- ✅ Text readable without zooming
- ✅ Buttons/links easily tappable
- ✅ Forms usable on mobile
- ✅ Tables scroll or adapt
- ✅ Images scale appropriately

#### 9.2 Mobile Navigation
1. Test navigation menu on mobile
2. Open/close mobile menu
3. Navigate between pages

**Expected Results:**
- ✅ Hamburger menu works
- ✅ Menu items accessible
- ✅ Menu closes after selection
- ✅ Back button works

#### 9.3 Touch Interactions
1. Test touch gestures:
   - Tap
   - Swipe
   - Pinch to zoom (if applicable)
   - Long press

**Expected Results:**
- ✅ Touch targets large enough (44x44px minimum)
- ✅ No accidental clicks
- ✅ Swipe gestures work (if implemented)
- ✅ Scrolling smooth

#### 9.4 Mobile Forms
1. Fill out forms on mobile device
2. Test all input types:
   - Text inputs
   - Dropdowns
   - Date pickers
   - File uploads
   - Checkboxes/radios

**Expected Results:**
- ✅ Keyboard appears correctly
- ✅ Input fields not obscured by keyboard
- ✅ Date picker mobile-friendly
- ✅ File upload works from camera/gallery
- ✅ Form validation visible

#### 9.5 Mobile Performance
1. Test app performance on mobile
2. Navigate through pages
3. Load data-heavy pages

**Expected Results:**
- ✅ Pages load quickly
- ✅ No lag or freezing
- ✅ Smooth scrolling
- ✅ Images load efficiently

#### 9.6 Orientation Changes
1. Rotate device between portrait and landscape
2. Test on multiple pages

**Expected Results:**
- ✅ Layout adapts to orientation
- ✅ No content cut off
- ✅ State preserved during rotation

#### 9.7 Mobile-Specific Features
1. Test camera access (for profile pictures)
2. Test file access (for document uploads)
3. Test geolocation (if used)

**Expected Results:**
- ✅ Camera permission requested
- ✅ Can take photo directly
- ✅ Can select from gallery
- ✅ Geolocation works (if implemented)

### Mobile Testing Checklist
- [ ] Test on real devices (not just emulators)
- [ ] Test on both iOS and Android
- [ ] Test on different screen sizes
- [ ] Test in both portrait and landscape
- [ ] Test with slow network (3G simulation)


## Test 10: Performance and Error Handling

### Test ID: PERF-001
**Priority:** Medium

### Test Procedure

#### 10.1 Page Load Performance
1. Open application with DevTools Performance tab
2. Navigate to various pages
3. Record load times

**Expected Results:**
- ✅ Initial page load < 3 seconds
- ✅ Subsequent page loads < 1 second
- ✅ API responses < 500ms (local) or < 2s (production)
- ✅ Images load progressively
- ✅ No blocking resources

**Metrics to Check:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)

#### 10.2 Network Error Handling
1. Simulate network errors:
   - Disconnect network
   - Block API requests
   - Simulate 500 errors

**Expected Results:**
- ✅ Error messages displayed
- ✅ User-friendly error text
- ✅ Retry options available
- ✅ App doesn't crash
- ✅ Graceful degradation

#### 10.3 API Error Handling
1. Test various API error scenarios:
   - 400 Bad Request
   - 401 Unauthorized
   - 403 Forbidden
   - 404 Not Found
   - 500 Internal Server Error

**Expected Results:**
- ✅ Appropriate error messages
- ✅ User redirected if needed (e.g., 401 → login)
- ✅ Error details logged (DevTools)
- ✅ No sensitive info exposed

#### 10.4 Form Validation Errors
1. Submit forms with invalid data
2. Test all validation rules

**Expected Results:**
- ✅ Client-side validation prevents submission
- ✅ Error messages clear and specific
- ✅ Invalid fields highlighted
- ✅ Backend validation as fallback

#### 10.5 Large Dataset Handling
1. Load pages with large datasets:
   - Cadet list with 100+ cadets
   - Grade list with many entries
   - Long message threads

**Expected Results:**
- ✅ Pagination implemented
- ✅ Virtual scrolling (if applicable)
- ✅ No performance degradation
- ✅ Smooth scrolling

#### 10.6 Concurrent Operations
1. Perform multiple operations simultaneously:
   - Upload multiple files
   - Submit multiple forms
   - Make multiple API calls

**Expected Results:**
- ✅ All operations complete successfully
- ✅ No race conditions
- ✅ Proper loading indicators
- ✅ No data corruption

#### 10.7 Memory Leaks
1. Use application for extended period
2. Navigate between pages repeatedly
3. Monitor memory usage in DevTools

**Expected Results:**
- ✅ Memory usage stable
- ✅ No continuous memory growth
- ✅ Event listeners cleaned up
- ✅ Components unmount properly

#### 10.8 Offline Behavior
1. Go offline while using app
2. Try to perform actions
3. Go back online

**Expected Results:**
- ✅ Offline status detected
- ✅ User notified of offline state
- ✅ Cached data available (if PWA)
- ✅ Sync when back online (if implemented)

#### 10.9 Session Timeout
1. Login and remain idle
2. Wait for token expiration
3. Try to perform action

**Expected Results:**
- ✅ Session timeout detected
- ✅ User notified
- ✅ Redirected to login
- ✅ Can resume after re-login

#### 10.10 Browser Console Errors
1. Navigate through entire application
2. Monitor console for errors
3. Test all features

**Expected Results:**
- ✅ No JavaScript errors
- ✅ No unhandled promise rejections
- ✅ No 404 errors for resources
- ✅ No CORS errors
- ✅ Warnings addressed

### Performance Testing Tools
- Chrome DevTools Performance tab
- Lighthouse audit
- Network throttling (Fast 3G, Slow 3G)
- Chrome DevTools Memory profiler

### Performance Benchmarks
- Lighthouse Performance Score: > 90
- Lighthouse Accessibility Score: > 90
- Lighthouse Best Practices Score: > 90
- Lighthouse SEO Score: > 80


## Automated Test Script

### Test Script: integration-test.js

A Node.js script to automate basic integration tests:

```javascript
#!/usr/bin/env node

const axios = require('axios');

const API_URL = process.argv[2] || 'http://localhost:8000';
const TEST_CREDENTIALS = {
  admin: { username: 'admin', password: 'admin123' },
  cadet: { username: 'cadet1', password: 'cadet123' },
  staff: { username: 'staff1', password: 'staff123' }
};

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function runTest(name, testFn) {
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function testLogin(role) {
  const response = await axios.post(`${API_URL}/api/auth/login`, TEST_CREDENTIALS[role]);
  if (!response.data.token) throw new Error('No token in response');
  return response.data.token;
}

async function testCadetList(token) {
  const response = await axios.get(`${API_URL}/api/cadets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.data.data) throw new Error('No data in response');
}

async function testGrades(token) {
  const response = await axios.get(`${API_URL}/api/grades`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.data.data) throw new Error('No data in response');
}

async function main() {
  console.log('='.repeat(60));
  console.log('Frontend Integration Tests');
  console.log(`API URL: ${API_URL}`);
  console.log('='.repeat(60));
  console.log('');

  // Authentication Tests
  console.log('Authentication Tests:');
  await runTest('Admin Login', () => testLogin('admin'));
  await runTest('Cadet Login', () => testLogin('cadet'));
  await runTest('Staff Login', () => testLogin('staff'));
  console.log('');

  // API Tests
  console.log('API Tests:');
  const adminToken = await testLogin('admin');
  await runTest('Cadet List', () => testCadetList(adminToken));
  await runTest('Grades List', () => testGrades(adminToken));
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${testResults.passed + testResults.failed}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log('');

  process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(console.error);
```

### Usage

```bash
# Install dependencies
npm install axios

# Run tests
node integration-test.js http://localhost:8000
node integration-test.js https://rotc-django-web.onrender.com
```


## Test Execution Checklist

### Pre-Test Setup
- [ ] Django backend is running and accessible
- [ ] React frontend is running (dev or production build)
- [ ] Test data is loaded in database
- [ ] Environment variables configured correctly
- [ ] CORS configured on backend
- [ ] Test user accounts created

### Test Execution Order
1. [ ] Test 1: Authentication (Critical)
2. [ ] Test 2: Cadet Management (Critical)
3. [ ] Test 3: Grade Management (Critical)
4. [ ] Test 4: Attendance Tracking (Critical)
5. [ ] Test 5: Messaging & Notifications (High)
6. [ ] Test 6: File Uploads (High)
7. [ ] Test 7: Real-time Updates (Medium)
8. [ ] Test 8: Cross-Browser (Medium)
9. [ ] Test 9: Mobile Responsiveness (High)
10. [ ] Test 10: Performance & Errors (Medium)

### Post-Test Activities
- [ ] Document all issues found
- [ ] Create bug reports for failures
- [ ] Verify fixes for critical issues
- [ ] Re-test failed scenarios
- [ ] Update test documentation
- [ ] Sign off on test completion

## Issue Tracking Template

### Issue Report Format

```markdown
**Issue ID:** ISSUE-001
**Test ID:** AUTH-001
**Severity:** Critical | High | Medium | Low
**Status:** Open | In Progress | Resolved | Closed

**Description:**
[Brief description of the issue]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

**Screenshots/Logs:**
[Attach screenshots or error logs]

**Resolution:**
[How the issue was fixed]
```

## Test Results Summary Template

```markdown
# Frontend Integration Test Results

**Test Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Development | Staging | Production
**Backend URL:** [URL]
**Frontend URL:** [URL]

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X
- Pass Rate: X%

## Test Results by Category

### Authentication (Critical)
- ✅ Admin Login
- ✅ Cadet Login
- ✅ Staff Login
- ❌ Token Persistence (Issue: ISSUE-001)

### Cadet Management (Critical)
- ✅ View Cadet List
- ✅ Create Cadet
- ✅ Update Cadet
- ✅ Archive Cadet

[Continue for all categories...]

## Critical Issues
1. [Issue description and ID]
2. [Issue description and ID]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Sign-off
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Ready for deployment

**Approved by:** [Name]
**Date:** YYYY-MM-DD
```


## Common Issues and Troubleshooting

### Issue 1: CORS Errors
**Symptoms:**
- Console shows: "Access to XMLHttpRequest blocked by CORS policy"
- API requests fail with CORS error

**Solutions:**
1. Verify `CORS_ALLOWED_ORIGINS` set on Django backend
2. Check that frontend URL is in allowed origins
3. Verify `CORS_ALLOW_CREDENTIALS = True` in Django settings
4. Check that Authorization header is in `CORS_ALLOW_HEADERS`

### Issue 2: Authentication Failures
**Symptoms:**
- Login fails with 401 Unauthorized
- Token not accepted by backend

**Solutions:**
1. Verify JWT token format: `Bearer <token>`
2. Check token expiration time
3. Verify `djangorestframework-simplejwt` configured correctly
4. Check that token is stored in localStorage
5. Verify Authorization header is set in axios defaults

### Issue 3: File Upload Failures
**Symptoms:**
- File uploads fail or timeout
- Images don't display after upload

**Solutions:**
1. Verify Cloudinary credentials configured
2. Check file size limits
3. Verify multipart/form-data content type
4. Check network tab for upload progress
5. Verify Cloudinary URLs are accessible

### Issue 4: Real-time Updates Not Working
**Symptoms:**
- WebSocket connection fails
- Updates don't appear in real-time

**Solutions:**
1. Verify Django Channels configured
2. Check Redis connection
3. Verify WebSocket URL correct (ws:// or wss://)
4. Check that token is passed in WebSocket connection
5. Verify firewall/proxy allows WebSocket connections

### Issue 5: Mobile Layout Issues
**Symptoms:**
- Layout broken on mobile
- Horizontal scrolling
- Text too small

**Solutions:**
1. Verify viewport meta tag in HTML
2. Check responsive CSS media queries
3. Test with DevTools responsive mode
4. Verify touch targets are large enough
5. Check for fixed-width elements

### Issue 6: Performance Issues
**Symptoms:**
- Slow page loads
- Laggy interactions
- High memory usage

**Solutions:**
1. Enable pagination for large lists
2. Implement lazy loading for images
3. Use React.memo for expensive components
4. Check for memory leaks (event listeners)
5. Optimize bundle size (code splitting)

### Issue 7: Session Timeout
**Symptoms:**
- User logged out unexpectedly
- API calls fail with 401 after some time

**Solutions:**
1. Implement token refresh mechanism
2. Increase token lifetime in Django settings
3. Add session timeout warning
4. Implement automatic token refresh

### Issue 8: Data Not Updating
**Symptoms:**
- Changes don't appear after save
- Stale data displayed

**Solutions:**
1. Verify cache invalidation working
2. Check that API calls succeed
3. Verify state updates in React
4. Check for caching issues in browser
5. Clear browser cache and test

## Browser DevTools Tips

### Network Tab
- Filter by XHR to see API calls
- Check request/response headers
- Verify request payload
- Check response status codes
- Monitor timing information

### Console Tab
- Check for JavaScript errors
- Look for unhandled promise rejections
- Verify API responses
- Test localStorage access

### Application Tab
- Check localStorage for token
- Verify cookies (if used)
- Check service worker status (PWA)
- Monitor cache storage

### Performance Tab
- Record page load
- Identify bottlenecks
- Check for long tasks
- Monitor memory usage

### Sources Tab
- Set breakpoints for debugging
- Step through code execution
- Inspect variable values
- Debug async operations

## Testing Best Practices

1. **Test in Order of Priority**
   - Critical features first (auth, core CRUD)
   - High-priority features next
   - Nice-to-have features last

2. **Use Real Data**
   - Test with realistic data volumes
   - Use actual file sizes
   - Test with production-like data

3. **Test Edge Cases**
   - Empty states
   - Maximum values
   - Invalid inputs
   - Network failures

4. **Document Everything**
   - Record all test results
   - Screenshot issues
   - Save error logs
   - Note environment details

5. **Regression Testing**
   - Re-test after fixes
   - Verify no new issues introduced
   - Test related functionality

6. **Cross-Platform Testing**
   - Test on multiple browsers
   - Test on mobile devices
   - Test on different OS versions

## Next Steps After Testing

### If All Tests Pass
1. Document test results
2. Create test report
3. Get sign-off from stakeholders
4. Proceed to production deployment
5. Monitor production for issues

### If Tests Fail
1. Document all failures
2. Prioritize issues by severity
3. Create bug reports
4. Fix critical issues first
5. Re-test after fixes
6. Repeat until all critical tests pass

### Production Deployment Checklist
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented and accepted
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Backup and rollback plan ready
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Support plan in place

## Contact and Support

For issues or questions during testing:
1. Check this documentation first
2. Review Django backend logs
3. Check browser console for errors
4. Consult the migration spec documentation
5. Contact the development team

**Documentation Location:**
- Migration Spec: `.kiro/specs/nodejs-to-django-migration/`
- Backend Config: `rotc_backend/DEPLOYMENT_GUIDE.md`
- Frontend Config: `client/DJANGO_BACKEND_CONFIGURATION.md`

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** Development Team

