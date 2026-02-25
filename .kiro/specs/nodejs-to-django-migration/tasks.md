# Implementation Plan: ROTC Grading System Migration (Node.js to Django)

## Overview

This implementation plan guides the complete migration of the ROTC Grading System from Node.js/Express to Python/Django. The migration maintains 100% API compatibility with the React frontend, preserves all existing data across 19 database tables, and implements real-time features using Django Channels, background processing with Celery, and caching with Redis.

The tasks are organized in logical phases following the migration workflow: Foundation → Core Features → Extended Features → Advanced Features → Integration & Testing → Data Migration → Deployment. Each task builds incrementally, validating functionality early through code. Property-based tests validate correctness properties from the design document.

## Implementation Phases

**Phase 1: Foundation (Tasks 1-3)** - Django project setup, database models, basic configuration
**Phase 2: Core API (Tasks 4-7)** - Authentication, user management, cadet management, grades
**Phase 3: Extended Features (Tasks 8-14)** - Attendance, activities, staff, messaging, notifications
**Phase 4: Advanced Features (Tasks 15-19)** - File uploads, caching, real-time updates, background tasks
**Phase 5: Integration (Tasks 20-26)** - System settings, audit logs, PDF, OCR, import/export, metrics
**Phase 6: Security & Quality (Tasks 27-30)** - Security hardening, admin interface, API compatibility, performance
**Phase 7: Data Migration (Tasks 31-32)** - Data export, migration, validation
**Phase 8: Deployment (Tasks 33-35)** - Render.com configuration, deployment, cutover

## Tasks

### Phase 1: Foundation

- [ ] 1. Django project setup and configuration
  - [ ] 1.1 Create Django project structure with config/ and apps/ directories
    - Initialize Django 5.0+ project with `django-admin startproject config .`
    - Create apps/ directory for all Django applications
    - Set up settings split: base.py, development.py, production.py
    - Configure DATABASES for PostgreSQL (production) and SQLite (development)
    - _Requirements: 1.1, 1.2, 1.3, 1.8, 1.9_

  - [ ] 1.2 Install and configure core dependencies
    - Create requirements.txt with Django 5.0+, djangorestframework 3.14+, Python 3.11+
    - Add django-cors-headers, psycopg2-binary, python-dotenv
    - Add django-storages, Pillow, cloudinary
    - Add celery, redis, django-channels, channels-redis
    - Add ReportLab, pytesseract, django-push-notifications, bcrypt
    - Add gunicorn, daphne, djangorestframework-simplejwt
    - Configure INSTALLED_APPS with all required packages
    - _Requirements: 1.2, 1.4, 1.5, 1.7_

  - [ ] 1.3 Configure CORS and static files
    - Configure django-cors-headers with CORS_ALLOWED_ORIGINS
    - Set up CORS_ALLOW_CREDENTIALS and CORS_ALLOW_HEADERS
    - Configure STATIC_URL, STATIC_ROOT, STATICFILES_DIRS
    - Set up static file serving for React frontend build
    - _Requirements: 1.4, 1.10, 24.3, 34.3_

  - [ ] 1.4 Configure environment variables and secrets
    - Create .env.example with all required environment variables
    - Configure SECRET_KEY, DEBUG, ALLOWED_HOSTS
    - Configure DATABASE_URL, REDIS_URL
    - Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
    - Set up environment-specific settings loading
    - _Requirements: 1.6, 27.10, 27.11, 27.15_

  - [ ]* 1.5 Write property test for environment configuration
    - **Property 1: Environment Variable Loading**
    - **Validates: Requirements 1.6, 27.15**
    - Test that all required environment variables load correctly
    - Test that missing required variables raise appropriate errors

- [ ] 2. Database models for all 19 tables
  - [ ] 2.1 Create authentication app with User and UserSettings models
    - Create apps/authentication/ Django app
    - Implement User model with all fields: username, email, password, role, is_approved, cadet_id, staff_id, profile_pic, location fields
    - Implement UserSettings model with one-to-one relationship to User
    - Add role choices: admin, cadet, training_staff
    - Configure db_table='users' and db_table='user_settings'
    - Add indexes on username, email, role
    - _Requirements: 2.1, 2.2, 2.3, 3.6, 3.7, 3.8, 3.12_

  - [ ]* 2.2 Write property tests for User model
    - **Property 7: Unique Constraint Enforcement**
    - **Validates: Requirements 2.6, 4.9**
    - Test that duplicate usernames/emails are rejected
    - **Property 8: Default Value Assignment**
    - **Validates: Requirements 2.7, 3.11**
    - Test that is_approved defaults to False

  - [ ] 2.3 Create cadets app with Cadet and Grades models
    - Create apps/cadets/ Django app
    - Implement Cadet model with all 30+ fields (student_id, names, company, platoon, course, year_level, status, profile fields)
    - Implement Grades model with one-to-one relationship to Cadet
    - Add unique constraint on student_id
    - Configure db_table='cadets' and db_table='grades'
    - Add indexes on student_id, company, platoon, is_archived
    - Set default values: status='Ongoing', is_archived=False, is_profile_completed=False
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 4.13_

  - [ ]* 2.4 Write property tests for Cadet and Grades models
    - **Property 13: Automatic Grades Creation**
    - **Validates: Requirements 4.15**
    - Test that creating a Cadet automatically creates associated Grades record
    - **Property 11: Soft Delete Preservation**
    - **Validates: Requirements 4.5, 4.6**
    - Test that deleting a Cadet sets is_archived=True

  - [ ] 2.5 Create grading app with MeritDemeritLog model
    - Create apps/grading/ Django app
    - Implement MeritDemeritLog model with foreign key to Cadet
    - Add type choices: merit, demerit
    - Add fields: points, reason, issued_by_user_id, issued_by_name, date_recorded
    - Configure db_table='merit_demerit_logs'
    - Add index on (cadet, date_recorded)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 5.10_

  - [ ]* 2.6 Write property tests for MeritDemeritLog model
    - **Property 14: Merit Points Accumulation**
    - **Validates: Requirements 5.8**
    - **Property 15: Demerit Points Accumulation**
    - **Validates: Requirements 5.9**
    - **Property 24: Positive Integer Validation**
    - **Validates: Requirements 5.11**

  - [ ] 2.7 Create attendance app with TrainingDay, AttendanceRecord, StaffAttendanceRecord, ExcuseLetter models
    - Create apps/attendance/ Django app
    - Implement TrainingDay model with date, title, description, location
    - Implement AttendanceRecord model with foreign keys to TrainingDay and Cadet
    - Add status choices: present, absent, late, excused
    - Add unique constraint on (training_day, cadet)
    - Implement StaffAttendanceRecord model with foreign keys to TrainingDay and TrainingStaff
    - Add unique constraint on (training_day, staff)
    - Implement ExcuseLetter model with foreign keys to Cadet and TrainingDay
    - Add status choices: pending, approved, rejected
    - Configure db_table names for all models
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.8, 6.9, 6.13, 8.8_

  - [ ]* 2.8 Write property tests for attendance models
    - **Property 17: Unique Attendance Constraint**
    - **Validates: Requirements 6.8**
    - **Property 18: Unique Staff Attendance Constraint**
    - **Validates: Requirements 6.13**
    - **Property 16: Attendance Count Increment**
    - **Validates: Requirements 6.14**

  - [ ] 2.9 Create activities app with Activity and ActivityImage models
    - Create apps/activities/ Django app
    - Implement Activity model with title, description, date, image_path, images, type
    - Add type choices: activity, achievement, event
    - Implement ActivityImage model with foreign key to Activity
    - Configure db_table='activities' and db_table='activity_images'
    - Add CASCADE delete for ActivityImage when Activity is deleted
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.8, 9.13_

  - [ ] 2.10 Create staff app with TrainingStaff model
    - Create apps/staff/ Django app
    - Implement TrainingStaff model with all profile fields matching Cadet structure
    - Add unique constraint on email
    - Add fields: rank, afpsn, role, has_seen_guide
    - Configure db_table='training_staff'
    - Add indexes on email, is_archived
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 10.7_

  - [ ] 2.11 Create messaging app with AdminMessage, StaffMessage, Notification, PushSubscription models
    - Create apps/messaging/ Django app
    - Implement AdminMessage model with foreign key to User
    - Add status choices: pending, replied
    - Implement StaffMessage model with foreign key to TrainingStaff
    - Implement Notification model with foreign key to User
    - Add is_read boolean field with default False
    - Implement PushSubscription model with endpoint and keys JSONField
    - Configure db_table names for all models
    - Add indexes on (user, is_read) for Notification
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.10, 11.8, 12.7_

  - [ ] 2.12 Create system app with SystemSettings, AuditLog, SyncEvent models
    - Create apps/system/ Django app
    - Implement SystemSettings model with key-value pairs
    - Add unique constraint on key field
    - Implement AuditLog model with table_name, operation, record_id, user_id, payload (JSONField)
    - Add operation choices: CREATE, UPDATE, DELETE
    - Implement SyncEvent model with event_type, cadet_id, payload (JSONField), processed
    - Configure db_table names for all models
    - Add indexes on (table_name, operation, created_at) for AuditLog
    - Add indexes on (processed, created_at) for SyncEvent
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.10, 2.12, 18.5, 19.1_

  - [ ]* 2.13 Write property tests for system models
    - **Property 9: JSON Field Round-Trip**
    - **Validates: Requirements 2.10**
    - **Property 10: Timestamp Auto-Generation**
    - **Validates: Requirements 2.12**

  - [ ] 2.14 Run database migrations and verify schema
    - Run `python manage.py makemigrations` for all apps
    - Run `python manage.py migrate` to create database tables
    - Verify all 19 tables exist with correct names
    - Verify all foreign key constraints are created
    - Verify all indexes are created
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.9_

- [ ] 3. Checkpoint - Verify database schema
  - Ensure all migrations run successfully, verify table names match Node.js schema exactly, ask the user if questions arise.


### Phase 2: Core API (Authentication, Users, Cadets, Grades)

- [ ] 4. Authentication system with bcrypt compatibility
  - [ ] 4.1 Implement bcrypt password hashing backend
    - Create custom authentication backend in apps/authentication/backends.py
    - Implement bcrypt password verification compatible with bcryptjs
    - Use bcrypt library with same work factor as Node.js version
    - Override Django's default password hasher
    - _Requirements: 3.1, 3.3, 28.10_

  - [ ]* 4.2 Write property tests for password hashing
    - **Property 1: Password Hash Compatibility**
    - **Validates: Requirements 3.1, 3.3**
    - **Property 42: Secure Password Hashing**
    - **Validates: Requirements 28.10**

  - [ ] 4.3 Implement JWT token authentication
    - Configure djangorestframework-simplejwt for JWT tokens
    - Create login endpoint returning JWT token
    - Create token refresh endpoint
    - Configure token expiration times
    - Implement custom token claims for user role
    - _Requirements: 3.2, 3.4, 28.11_

  - [ ]* 4.4 Write property tests for JWT authentication
    - **Property 2: Authentication Token Generation**
    - **Validates: Requirements 3.2, 3.4**
    - **Property 37: Authentication Header Format**
    - **Validates: Requirements 24.7, 34.4**

  - [ ] 4.5 Implement role-based permission classes
    - Create IsAdmin, IsCadet, IsTrainingStaff permission classes
    - Implement is_approved check in permission classes
    - Create permission decorators for views
    - _Requirements: 3.5, 3.6, 28.18_

  - [ ]* 4.6 Write property tests for role-based access control
    - **Property 3: Role-Based Access Control**
    - **Validates: Requirements 3.5, 28.18**

  - [ ] 4.7 Create authentication API endpoints
    - Implement POST /api/auth/login (username, password → token, user, role)
    - Implement POST /api/auth/register (user data → user, is_approved)
    - Implement POST /api/auth/logout (token invalidation)
    - Implement GET /api/auth/profile (user profile with related data)
    - Create serializers for User, Cadet, TrainingStaff
    - _Requirements: 3.2, 3.9, 3.10, 3.11, 4.12_

  - [ ]* 4.8 Write property tests for authentication endpoints
    - **Property 4: Token Invalidation on Logout**
    - **Validates: Requirements 3.10**

- [ ] 5. Cadet management API endpoints
  - [ ] 5.1 Create cadet serializers with nested grades
    - Create CadetSerializer with all fields
    - Create GradesSerializer
    - Create CadetWithGradesSerializer with nested grades
    - Implement validation for required fields
    - Implement validation for unique student_id
    - _Requirements: 4.8, 4.9, 4.12_

  - [ ] 5.2 Implement cadet list and detail endpoints
    - Implement GET /api/cadets (list all non-archived cadets)
    - Implement GET /api/cadets/:id (single cadet with grades)
    - Implement GET /api/cadets/archived (archived cadets)
    - Add filtering by company, platoon, course, year_level, status
    - Add search by name or student_id
    - Add pagination with page, limit, total
    - _Requirements: 4.1, 4.2, 4.6, 4.10, 4.11, 24.9_

  - [ ]* 5.3 Write property tests for cadet filtering and search
    - **Property 29: Filtering Returns Matching Records Only**
    - **Validates: Requirements 4.10**
    - **Property 30: Search Returns Matching Records**
    - **Validates: Requirements 4.11**

  - [ ] 5.4 Implement cadet create, update, delete endpoints
    - Implement POST /api/cadets (create new cadet)
    - Implement PUT /api/cadets/:id (update cadet)
    - Implement DELETE /api/cadets/:id (soft delete - set is_archived=True)
    - Implement POST /api/cadets/:id/restore (unarchive cadet)
    - Add Django signals to auto-create Grades on Cadet creation
    - _Requirements: 4.3, 4.4, 4.5, 4.7, 4.15_

  - [ ]* 5.5 Write property tests for cadet CRUD operations
    - **Property 12: Soft Delete Restoration**
    - **Validates: Requirements 4.7**

  - [ ] 5.6 Implement profile picture upload for cadets
    - Add profile picture upload handling in cadet update endpoint
    - Validate image file types and sizes
    - Store Cloudinary URL in profile_pic field
    - _Requirements: 4.14, 7.3_

- [ ] 6. Grading system API endpoints
  - [ ] 6.1 Create grades and merit/demerit serializers
    - Create GradesSerializer with all fields
    - Create MeritDemeritLogSerializer
    - Create GradesDetailSerializer with merit/demerit history
    - _Requirements: 5.10_

  - [ ] 6.2 Implement grades list and detail endpoints
    - Implement GET /api/grades (all grades with cadet info)
    - Implement GET /api/grades/:cadet_id (grades for specific cadet)
    - Include nested merit/demerit logs in detail view
    - _Requirements: 5.1, 5.2_

  - [ ] 6.3 Implement grades update endpoint
    - Implement PUT /api/grades/:cadet_id
    - Support updating attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score
    - Add validation for score ranges
    - _Requirements: 5.3, 5.4_

  - [ ] 6.4 Implement merit/demerit log endpoints
    - Implement POST /api/merit-demerit (create log entry)
    - Implement GET /api/merit-demerit/:cadet_id (get history)
    - Implement DELETE /api/merit-demerit/:id (remove log entry)
    - Add validation for type (merit/demerit) and positive points
    - _Requirements: 5.5, 5.6, 5.7, 5.11, 5.12_

  - [ ] 6.5 Implement automatic grade updates via Django signals
    - Create post_save signal for MeritDemeritLog
    - Update Grades.merit_points when merit log is added
    - Update Grades.demerit_points when demerit log is added
    - Create post_delete signal to reverse updates when log is deleted
    - _Requirements: 5.8, 5.9_

  - [ ]* 6.6 Write unit tests for grade calculation logic
    - Test merit/demerit point accumulation
    - Test grade update signal handlers
    - Test validation for score ranges

  - [ ] 6.7 Implement audit logging for grade changes
    - Create post_save signal for Grades model
    - Create audit_logs entry on CREATE, UPDATE operations
    - Store table_name, operation, record_id, user_id, payload
    - _Requirements: 5.14, 19.1, 19.11_

  - [ ] 6.8 Implement sync events for real-time updates
    - Create post_save signal for MeritDemeritLog and Grades
    - Create sync_events entry with event_type and cadet_id
    - Store payload with updated grade data
    - _Requirements: 5.15, 19.7_

- [ ] 7. Checkpoint - Verify core API functionality
  - Ensure authentication, cadet management, and grading endpoints work correctly, test with Postman or curl, ask the user if questions arise.

### Phase 3: Extended Features (Attendance, Activities, Staff, Messaging)

- [ ] 8. Attendance tracking API endpoints
  - [ ] 8.1 Create attendance serializers
    - Create TrainingDaySerializer
    - Create AttendanceRecordSerializer
    - Create StaffAttendanceRecordSerializer
    - Create ExcuseLetterSerializer
    - _Requirements: 6.9, 8.8_

  - [ ] 8.2 Implement training day endpoints
    - Implement GET /api/training-days (list all training days)
    - Implement POST /api/training-days (create training day)
    - Implement PUT /api/training-days/:id (update training day)
    - Implement DELETE /api/training-days/:id (delete training day)
    - Add ordering by date (most recent first)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 8.3 Implement cadet attendance endpoints
    - Implement GET /api/attendance/:training_day_id (get attendance records)
    - Implement POST /api/attendance (create attendance record)
    - Implement PUT /api/attendance/:id (update attendance status)
    - Implement POST /api/attendance/bulk (bulk create for all cadets)
    - Add unique constraint validation for (training_day, cadet)
    - Add status validation (present, absent, late, excused)
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.16_

  - [ ] 8.4 Implement attendance grade update via signals
    - Create post_save signal for AttendanceRecord
    - Increment Grades.attendance_present when status='present'
    - Decrement when status changes from 'present' to other status
    - _Requirements: 6.14_

  - [ ] 8.5 Implement staff attendance endpoints
    - Implement GET /api/staff-attendance/:training_day_id
    - Implement POST /api/staff-attendance (create staff attendance)
    - Add unique constraint validation for (training_day, staff)
    - _Requirements: 6.11, 6.12, 6.13_

  - [ ] 8.6 Implement QR code attendance check-in
    - Implement POST /api/attendance/qr-checkin endpoint
    - Generate QR codes for training days
    - Validate QR code and create attendance record
    - _Requirements: 6.15_

  - [ ]* 8.7 Write property tests for attendance constraints
    - **Property 19: Excuse Letter Approval Updates Attendance**
    - **Validates: Requirements 8.12**

- [ ] 9. Excuse letter management API endpoints
  - [ ] 9.1 Implement excuse letter endpoints
    - Implement GET /api/excuse-letters (list all excuse letters)
    - Implement GET /api/excuse-letters/cadet/:cadet_id (letters for cadet)
    - Implement POST /api/excuse-letters (create excuse letter)
    - Implement PUT /api/excuse-letters/:id (update status)
    - Implement DELETE /api/excuse-letters/:id (delete excuse letter)
    - Add filtering by status (pending, approved, rejected)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.11_

  - [ ] 9.2 Implement excuse letter approval logic
    - Create post_save signal for ExcuseLetter
    - When status='approved', update linked AttendanceRecord to 'excused'
    - Handle case where training_day_id is null
    - _Requirements: 8.12, 8.13_

  - [ ] 9.3 Add file upload support for excuse letters
    - Support file_url field for uploaded documents
    - Validate file types (PDF, DOCX, images)
    - _Requirements: 8.7, 7.4_

- [ ] 10. Activities and achievements API endpoints
  - [ ] 10.1 Create activity serializers with nested images
    - Create ActivitySerializer
    - Create ActivityImageSerializer
    - Create ActivityWithImagesSerializer with nested images
    - _Requirements: 9.10_

  - [ ] 10.2 Implement activity CRUD endpoints
    - Implement GET /api/activities (list all activities)
    - Implement GET /api/activities/:id (single activity with images)
    - Implement POST /api/activities (create activity)
    - Implement PUT /api/activities/:id (update activity)
    - Implement DELETE /api/activities/:id (delete activity with cascade)
    - Add filtering by type (activity, achievement, event) and date range
    - Add pagination
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.11, 9.12, 9.13_

  - [ ] 10.3 Implement multiple image upload for activities
    - Support multiple image uploads in activity create/update
    - Create ActivityImage records for each uploaded image
    - Store image URLs in images TEXT field as JSON array
    - _Requirements: 7.5, 9.9_

  - [ ]* 10.4 Write property tests for activity cascade deletion
    - **Property 5: Foreign Key Cascade Deletion**
    - **Validates: Requirements 2.4**

- [ ] 11. Training staff management API endpoints
  - [ ] 11.1 Create staff serializers
    - Create TrainingStaffSerializer with all profile fields
    - Create StaffWithUserSerializer including user account data
    - _Requirements: 10.12_

  - [ ] 11.2 Implement staff CRUD endpoints
    - Implement GET /api/staff (list all non-archived staff)
    - Implement GET /api/staff/:id (single staff member)
    - Implement POST /api/staff (create staff record)
    - Implement PUT /api/staff/:id (update staff record)
    - Implement DELETE /api/staff/:id (soft delete - set is_archived=True)
    - Add filtering by role
    - Add validation for required fields and unique email
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.11_

  - [ ] 11.3 Implement staff profile picture upload
    - Add profile picture upload handling in staff update endpoint
    - Store Cloudinary URL in profile_pic field
    - _Requirements: 10.14, 7.3_

  - [ ] 11.4 Implement optional user account creation for staff
    - Add logic to create User account when staff is created
    - Link User.staff_id to TrainingStaff.id
    - Set role='training_staff'
    - _Requirements: 10.13_

- [ ] 12. Messaging system API endpoints
  - [ ] 12.1 Create message serializers
    - Create AdminMessageSerializer
    - Create StaffMessageSerializer
    - Add user and staff relationship serialization
    - _Requirements: 11.6, 11.7_

  - [ ] 12.2 Implement admin message endpoints
    - Implement GET /api/messages/admin (get messages for current user)
    - Implement POST /api/messages/admin (create admin message)
    - Implement PUT /api/messages/admin/:id (admin reply)
    - Add filtering by status (pending, replied)
    - Add ordering by created_at
    - _Requirements: 11.1, 11.2, 11.3, 11.8, 11.13, 11.14_

  - [ ] 12.3 Implement staff message endpoints
    - Implement GET /api/messages/staff (get staff chat messages)
    - Implement POST /api/messages/staff (create staff message)
    - Add ordering by created_at
    - _Requirements: 11.4, 11.5, 11.7, 11.14_

  - [ ] 12.4 Implement notification creation on new messages
    - Create post_save signal for AdminMessage
    - Create post_save signal for StaffMessage
    - Create Notification for recipient(s)
    - _Requirements: 11.15_

  - [ ]* 12.5 Write property tests for notification creation
    - **Property 31: Notification Creation on Message**
    - **Validates: Requirements 11.15**

- [ ] 13. Notification system API endpoints
  - [ ] 13.1 Create notification serializers
    - Create NotificationSerializer
    - Create PushSubscriptionSerializer
    - _Requirements: 12.5, 12.14_

  - [ ] 13.2 Implement notification endpoints
    - Implement GET /api/notifications (get notifications for current user)
    - Implement POST /api/notifications (create notification)
    - Implement PUT /api/notifications/:id/read (mark as read)
    - Implement DELETE /api/notifications/:id (delete notification)
    - Implement GET /api/notifications/unread/count (unread count)
    - Add filtering by is_read status
    - Add ordering by created_at
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.10, 12.11_

  - [ ] 13.3 Implement push notification subscription endpoints
    - Implement POST /api/push/subscribe (register push subscription)
    - Store endpoint and keys in PushSubscription model
    - _Requirements: 12.13, 12.14_

  - [ ] 13.4 Configure django-push-notifications
    - Install and configure django-push-notifications
    - Set up web push VAPID keys
    - Configure push notification settings
    - _Requirements: 12.12, 12.16_

- [ ] 14. Checkpoint - Verify extended API functionality
  - Ensure attendance, activities, staff, messaging, and notification endpoints work correctly, test API compatibility with frontend expectations, ask the user if questions arise.

### Phase 4: Advanced Features (Files, Caching, Real-time, Background Tasks)

- [ ] 15. File upload and Cloudinary integration
  - [ ] 15.1 Configure Cloudinary with django-storages
    - Install and configure django-storages for Cloudinary
    - Configure CLOUDINARY_STORAGE settings
    - Set up DEFAULT_FILE_STORAGE for Cloudinary
    - Configure cloudinary credentials from environment variables
    - _Requirements: 7.1, 7.6_

  - [ ] 15.2 Create file upload service
    - Create apps/files/ Django app
    - Implement file upload utility functions
    - Add image compression using Pillow
    - Add file type and size validation
    - _Requirements: 7.8, 7.9_

  - [ ] 15.3 Implement file upload endpoint
    - Implement POST /api/upload (multipart/form-data)
    - Support type parameter: profile_pic, excuse_letter, activity_image
    - Support entity_id parameter for linking to records
    - Return Cloudinary URL, public_id, format
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.7_

  - [ ]* 15.4 Write property tests for file uploads
    - **Property 25: File Upload Returns URL**
    - **Validates: Requirements 7.2, 7.7**
    - **Property 26: File Type Validation**
    - **Validates: Requirements 7.8**
    - **Property 27: File Size Validation**
    - **Validates: Requirements 7.8**

  - [ ] 15.5 Implement file deletion endpoint
    - Implement DELETE /api/upload/:public_id
    - Delete file from Cloudinary
    - Return success/failure status
    - _Requirements: 7.11_

  - [ ] 15.6 Implement activity image upload handling
    - Create ActivityImage records on image upload
    - Link images to Activity via foreign key
    - Update Activity.images JSON field
    - _Requirements: 7.13, 7.14_

  - [ ]* 15.7 Write property tests for activity image records
    - **Property 28: Activity Image Record Creation**
    - **Validates: Requirements 7.13**

  - [ ] 15.8 Preserve existing Cloudinary URLs during migration
    - Ensure migration script preserves all URL fields
    - Validate URLs are accessible after migration
    - _Requirements: 7.12_

- [ ] 16. Redis caching implementation
  - [ ] 16.1 Configure Redis cache backend
    - Install redis and django-redis packages
    - Configure CACHES with Redis backend
    - Set up REDIS_URL from environment variable
    - Configure cache key prefix
    - _Requirements: 15.1, 27.11_

  - [ ] 16.2 Implement cache utility functions
    - Create core/cache.py with cache helper functions
    - Implement cache key generation functions
    - Implement cache invalidation patterns
    - _Requirements: 15.6, 15.9_

  - [ ] 16.3 Add caching to cadet list endpoint
    - Cache cadet list results with 5-minute TTL
    - Use query parameters in cache key
    - Invalidate on cadet create/update/delete
    - _Requirements: 15.2, 15.12_

  - [ ] 16.4 Add caching to grades endpoints
    - Cache grade summaries with 5-minute TTL
    - Invalidate on grade updates
    - Invalidate on merit/demerit log changes
    - _Requirements: 15.3, 15.13_

  - [ ] 16.5 Add caching to training day list
    - Cache training day list with 10-minute TTL
    - Invalidate on training day create/update/delete
    - _Requirements: 15.4_

  - [ ] 16.6 Add caching to system settings
    - Cache system settings with 30-minute TTL
    - Invalidate on setting updates
    - _Requirements: 15.5, 18.7, 18.11_

  - [ ] 16.7 Implement cache fallback for Redis unavailability
    - Add try-except blocks around cache operations
    - Fall back to database queries when Redis is down
    - Log warnings for cache failures
    - _Requirements: 15.10_

  - [ ]* 16.8 Write property tests for caching
    - **Property 32: Cache Invalidation on Update**
    - **Validates: Requirements 15.6, 15.12, 15.13**
    - **Property 33: Cache Fallback on Unavailability**
    - **Validates: Requirements 15.10**

  - [ ] 16.9 Implement cache statistics endpoint
    - Implement GET /api/cache/stats
    - Return cache hit/miss ratios
    - Restrict to admin role
    - _Requirements: 15.7, 20.4_

  - [ ] 16.10 Implement cache clear endpoint
    - Implement POST /api/cache/clear
    - Clear all cache entries
    - Restrict to admin role
    - _Requirements: 15.14_

- [ ] 17. Django Channels for real-time updates
  - [ ] 17.1 Configure Django Channels and Redis channel layer
    - Install channels and channels-redis packages
    - Configure ASGI application in config/asgi.py
    - Configure CHANNEL_LAYERS with Redis backend
    - Set up routing for WebSocket connections
    - _Requirements: 13.1, 13.3_

  - [ ] 17.2 Create WebSocket consumer for updates
    - Create apps/messaging/consumers.py
    - Implement UpdatesConsumer with connect, disconnect, receive methods
    - Implement token-based WebSocket authentication
    - Add user to appropriate groups (user-specific, role-specific)
    - _Requirements: 13.2, 13.7, 13.8_

  - [ ] 17.3 Implement WebSocket broadcasting for grade updates
    - Create utility function to broadcast grade updates
    - Call from sync_events signal handlers
    - Format messages compatible with React frontend
    - _Requirements: 13.4, 13.9_

  - [ ] 17.4 Implement WebSocket broadcasting for attendance updates
    - Broadcast attendance changes via WebSocket
    - Include cadet_id and updated attendance count
    - _Requirements: 13.5_

  - [ ] 17.5 Implement WebSocket broadcasting for exam score updates
    - Broadcast exam score changes via WebSocket
    - Include cadet_id and updated scores
    - _Requirements: 13.6_

  - [ ] 17.6 Implement sync event processing
    - Create background task to process sync_events
    - Broadcast events via WebSocket
    - Mark events as processed
    - _Requirements: 13.11, 13.12_

  - [ ] 17.7 Implement SSE fallback endpoint for backward compatibility
    - Implement GET /api/events (Server-Sent Events)
    - Poll sync_events and stream to client
    - Maintain compatibility with existing SSE clients
    - _Requirements: 13.10_

  - [ ]* 17.8 Write integration tests for WebSocket connections
    - Test WebSocket connection and authentication
    - Test message broadcasting to correct users
    - Test reconnection handling

  - [ ] 17.9 Implement WebSocket error handling
    - Handle connection errors gracefully
    - Implement reconnection logic
    - Support message replay for disconnected clients
    - _Requirements: 13.14, 13.15_

- [ ] 18. Celery for background task processing
  - [ ] 18.1 Configure Celery with Redis broker
    - Install celery package
    - Create config/celery.py with Celery app configuration
    - Configure CELERY_BROKER_URL with Redis
    - Configure CELERY_RESULT_BACKEND with Redis
    - Set up task autodiscovery
    - _Requirements: 14.1, 14.2_

  - [ ] 18.2 Create image compression background task
    - Create apps/files/tasks.py
    - Implement compress_and_upload_image Celery task
    - Use Pillow for image compression
    - Upload to Cloudinary after compression
    - _Requirements: 14.3, 7.9_

  - [ ] 18.3 Create PDF generation background task
    - Create apps/reports/tasks.py
    - Implement generate_pdf_report Celery task
    - Use ReportLab for PDF generation
    - Store result in cache or return URL
    - _Requirements: 14.4, 21.8_

  - [ ] 18.4 Create OCR processing background task
    - Create apps/files/tasks.py (if not exists)
    - Implement process_ocr_document Celery task
    - Use pytesseract for text extraction
    - Store extracted text in database
    - _Requirements: 14.5, 22.7_

  - [ ] 18.5 Create bulk import background task
    - Create apps/integration/tasks.py
    - Implement import_rotcmis_data Celery task
    - Process large data imports in background
    - _Requirements: 14.6, 16.11_

  - [ ] 18.6 Create email notification background task
    - Implement send_email_notification Celery task
    - Configure email backend (SMTP)
    - _Requirements: 14.7_

  - [ ] 18.7 Create push notification background task
    - Implement send_push_notifications Celery task
    - Use django-push-notifications to send to devices
    - Handle failures gracefully
    - _Requirements: 12.15_

  - [ ] 18.8 Implement task retry logic
    - Configure retry with exponential backoff
    - Set max_retries for each task type
    - Log retry attempts
    - _Requirements: 14.9_

  - [ ] 18.9 Implement task status endpoints
    - Implement GET /api/tasks/:task_id/status
    - Return task state, result, or error
    - _Requirements: 14.8_

  - [ ] 18.10 Implement admin notification on task failure
    - Create post-task signal handler
    - Create Notification for admins on task failure
    - _Requirements: 14.13_

  - [ ] 18.11 Configure periodic tasks with Celery Beat
    - Configure CELERY_BEAT_SCHEDULE
    - Add periodic task for data cleanup
    - Add periodic task for report generation
    - _Requirements: 14.11, 14.12_

  - [ ] 18.12 Implement Celery worker health check endpoint
    - Implement GET /api/celery/health
    - Check worker status and queue length
    - Restrict to admin role
    - _Requirements: 14.15_

  - [ ]* 18.13 Write integration tests for Celery tasks
    - Test task execution and results
    - Test retry logic
    - Test task status tracking

- [ ] 19. Checkpoint - Verify advanced features
  - Ensure file uploads, caching, WebSocket, and Celery tasks work correctly, test real-time updates in browser, ask the user if questions arise.

### Phase 5: Integration (System Settings, Audit, PDF, OCR, Import/Export, Metrics)

- [ ] 20. System settings and user preferences API
  - [ ] 20.1 Create system settings serializers
    - Create SystemSettingsSerializer
    - Create UserSettingsSerializer
    - _Requirements: 17.13, 18.10_

  - [ ] 20.2 Implement system settings endpoints
    - Implement GET /api/system-settings (all settings, admin only)
    - Implement GET /api/system-settings/:key (specific setting)
    - Implement PUT /api/system-settings/:key (update setting, admin only)
    - Implement POST /api/system-settings/bulk (bulk update, admin only)
    - Add validation for setting values based on key
    - _Requirements: 18.1, 18.2, 18.3, 18.8, 18.9, 18.15_

  - [ ] 20.3 Implement default system settings
    - Create migration to populate default settings
    - Add settings: school_year, semester, current_battalion, maintenance_mode
    - _Requirements: 18.6, 18.13_

  - [ ] 20.4 Implement system settings audit logging
    - Create post_save signal for SystemSettings
    - Create audit_logs entry on updates
    - _Requirements: 18.14_

  - [ ] 20.5 Implement system settings WebSocket broadcast
    - Broadcast setting changes via WebSocket
    - Notify all connected clients of updates
    - _Requirements: 18.12_

  - [ ] 20.6 Implement user settings endpoints
    - Implement GET /api/settings (get current user's settings)
    - Implement PUT /api/settings (update user preferences)
    - Implement POST /api/settings/reset (reset to defaults)
    - _Requirements: 17.1, 17.2, 17.15_

  - [ ] 20.7 Create default user settings on user creation
    - Create post_save signal for User model
    - Auto-create UserSettings with defaults
    - _Requirements: 17.10_

  - [ ] 20.8 Implement user settings validation
    - Validate primary_color against allowed colors
    - Validate boolean fields
    - _Requirements: 17.12_

  - [ ] 20.9 Implement user settings cache invalidation
    - Invalidate cache on settings update
    - _Requirements: 17.14_

- [ ] 21. Audit logging and sync events
  - [ ] 21.1 Implement audit log endpoints
    - Implement GET /api/audit-logs (admin only)
    - Add filtering by table_name, operation, user_id, date range
    - Add pagination
    - _Requirements: 19.5, 19.6_

  - [ ] 21.2 Implement audit log signal handlers
    - Create generic signal handler for tracked models
    - Capture CREATE, UPDATE, DELETE operations
    - Store payload as JSON (exclude sensitive fields)
    - _Requirements: 19.1, 19.2, 19.3, 19.11, 19.12_

  - [ ]* 21.3 Write property tests for audit logging
    - **Property 20: Audit Log Creation on Data Modification**
    - **Validates: Requirements 5.14, 19.1, 19.11**

  - [ ] 21.4 Implement sync event endpoints
    - Implement GET /api/sync-events (admin only, for debugging)
    - Add filtering by processed status
    - _Requirements: 19.10_

  - [ ] 21.5 Implement sync event signal handlers
    - Create signal handlers for grade-related models
    - Create sync_events with event_type, cadet_id, payload
    - _Requirements: 19.7, 19.8_

  - [ ]* 21.6 Write property tests for sync events
    - **Property 21: Sync Event Creation on Grade Changes**
    - **Validates: Requirements 5.15, 19.7**

  - [ ] 21.7 Implement audit log export functionality
    - Implement GET /api/audit-logs/export (CSV/Excel)
    - Add date range filtering
    - Restrict to admin role
    - _Requirements: 19.15_

  - [ ] 21.8 Implement audit log retention policy
    - Create periodic Celery task to archive old logs
    - Configure retention period (e.g., 1 year)
    - _Requirements: 19.13_

- [ ] 22. PDF generation and reporting
  - [ ] 22.1 Create PDF generation utilities
    - Create apps/reports/ Django app
    - Create apps/reports/generators.py with ReportLab utilities
    - Implement PDF templates with headers and logos
    - _Requirements: 21.1, 21.6, 21.12_

  - [ ] 22.2 Implement cadet profile PDF endpoint
    - Implement GET /api/reports/cadet/:id
    - Generate PDF with cadet profile and grades
    - Return PDF with proper Content-Type
    - _Requirements: 21.2_

  - [ ] 22.3 Implement grade report PDF endpoint
    - Implement GET /api/reports/grades
    - Support filtering by company, platoon, date range
    - Generate PDF with grade tables
    - _Requirements: 21.3, 21.9_

  - [ ] 22.4 Implement attendance report PDF endpoint
    - Implement GET /api/reports/attendance
    - Support filtering by training day, company, platoon
    - Generate PDF with attendance tables
    - _Requirements: 21.4, 21.9_

  - [ ] 22.5 Implement achievement certificate PDF endpoint
    - Implement GET /api/certificates/:activity_id
    - Generate certificate with activity details
    - Include QR code for verification
    - _Requirements: 21.5, 21.15_

  - [ ] 22.6 Implement PDF caching
    - Cache generated PDFs for 1 hour
    - Use cache key based on report type and parameters
    - _Requirements: 21.11_

  - [ ] 22.7 Implement batch PDF generation
    - Support generating PDFs for multiple cadets
    - Process as background Celery task
    - _Requirements: 21.14_

  - [ ] 22.8 Implement PDF generation audit logging
    - Log all PDF generation operations
    - Store report type and parameters
    - _Requirements: 21.13_

- [ ] 23. OCR document processing
  - [ ] 23.1 Configure pytesseract
    - Install Tesseract OCR system dependency
    - Configure pytesseract path in settings
    - Validate Tesseract installation
    - _Requirements: 22.1, 22.10_

  - [ ] 23.2 Create OCR processing utilities
    - Create apps/files/ocr.py with OCR functions
    - Implement image preprocessing (contrast, rotation)
    - Support multiple languages (English, Filipino)
    - _Requirements: 22.6, 22.11_

  - [ ] 23.3 Implement OCR processing endpoint
    - Implement POST /api/ocr/process
    - Accept image uploads
    - Return extracted text and confidence scores
    - _Requirements: 22.2, 22.14_

  - [ ] 23.4 Implement OCR for excuse letters
    - Integrate OCR with excuse letter upload
    - Extract text from excuse letter images
    - Store extracted text in database
    - _Requirements: 22.3, 8.14_

  - [ ] 23.5 Implement OCR for scanned forms
    - Support OCR for various document types
    - Handle PDF and image formats
    - _Requirements: 22.4, 22.5_

  - [ ] 23.6 Implement OCR result caching
    - Cache OCR results to avoid reprocessing
    - Use file hash as cache key
    - _Requirements: 22.12_

  - [ ] 23.7 Implement OCR error handling
    - Handle OCR failures gracefully
    - Return fallback messages
    - Log errors and notify admins
    - _Requirements: 22.9, 22.13_

  - [ ] 23.8 Implement batch OCR processing
    - Support processing multiple documents
    - Process as background Celery task
    - _Requirements: 22.15_

- [ ] 24. Data import/export and ROTCMIS integration
  - [ ] 24.1 Create import/export utilities
    - Create apps/integration/ Django app
    - Install openpyxl for Excel support
    - Create CSV and Excel generation utilities
    - _Requirements: 16.4, 16.10_

  - [ ] 24.2 Implement ROTCMIS import endpoint
    - Implement POST /api/import/rotcmis
    - Accept JSON data in ROTCMIS format
    - Validate data before insertion
    - Process as background Celery task for large imports
    - _Requirements: 16.1, 16.5, 16.6, 16.11_

  - [ ] 24.3 Implement import status and error reporting
    - Return import task ID
    - Provide status endpoint for import progress
    - Return detailed error messages for validation failures
    - _Requirements: 16.7, 16.13_

  - [ ] 24.4 Implement Excel export endpoint
    - Implement GET /api/export/excel
    - Support exporting cadets, grades, attendance, activities
    - Add filtering by date range, company, platoon
    - Generate Excel with proper formatting
    - _Requirements: 16.2, 16.8, 16.9, 16.10_

  - [ ] 24.5 Implement CSV export endpoint
    - Implement GET /api/export/csv
    - Support same data types as Excel export
    - Add filtering options
    - _Requirements: 16.3, 16.9_

  - [ ] 24.6 Implement bulk update via CSV import
    - Support CSV import for bulk updates
    - Validate data before updating
    - _Requirements: 16.14_

  - [ ] 24.7 Implement import/export audit logging
    - Log all import/export operations
    - Store operation type, user, record counts
    - _Requirements: 16.15_

  - [ ] 24.8 Implement data preservation during imports
    - Prevent overwrites without confirmation
    - Support merge strategies
    - _Requirements: 16.12_

- [ ] 25. Performance monitoring and metrics
  - [ ] 25.1 Create performance monitoring middleware
    - Create apps/system/middleware.py
    - Implement request/response timing middleware
    - Track request count, response times, error rates
    - _Requirements: 20.2, 20.9_

  - [ ] 25.2 Implement metrics endpoint
    - Implement GET /api/metrics (admin only)
    - Return performance metrics: request count, avg response time, error rate
    - _Requirements: 20.1, 20.13, 20.14_

  - [ ] 25.3 Implement database metrics endpoint
    - Implement GET /api/metrics/database (admin only)
    - Return query count, execution times, connection pool stats
    - _Requirements: 20.3, 20.7_

  - [ ] 25.4 Implement cache metrics endpoint
    - Implement GET /api/metrics/cache (admin only)
    - Return cache hit/miss ratios, memory usage
    - _Requirements: 20.4, 20.8_

  - [ ] 25.5 Implement health check endpoint
    - Implement GET /api/health
    - Check database, Redis, Celery connectivity
    - Return overall health status
    - _Requirements: 20.6, 27.9_

  - [ ] 25.6 Implement slow query logging
    - Configure Django to log queries >100ms
    - Store slow query logs for analysis
    - _Requirements: 20.10_

  - [ ] 25.7 Implement active session tracking
    - Track active user sessions
    - Return count in metrics endpoint
    - _Requirements: 20.5_

  - [ ] 25.8 Implement Prometheus-compatible metrics export
    - Add prometheus_client package
    - Expose metrics in Prometheus format
    - _Requirements: 20.12_

  - [ ] 25.9 Implement custom performance alerts
    - Create notifications for performance thresholds
    - Alert admins on high error rates or slow responses
    - _Requirements: 20.15_

- [ ] 26. Checkpoint - Verify integration features
  - Ensure system settings, audit logs, PDF generation, OCR, import/export, and metrics work correctly, ask the user if questions arise.

### Phase 6: Security & Quality (Security, Admin, API Compatibility, Performance)

- [ ] 27. Security hardening and error handling
  - [ ] 27.1 Configure Django security settings
    - Enable CSRF protection for state-changing operations
    - Set SECURE_SSL_REDIRECT=True for production
    - Configure secure cookie flags: SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE, SESSION_COOKIE_HTTPONLY
    - Set SESSION_COOKIE_SAMESITE='Lax'
    - Enable SECURE_BROWSER_XSS_FILTER
    - Enable X_FRAME_OPTIONS='DENY'
    - _Requirements: 28.1, 28.4, 28.5, 28.16_

  - [ ] 27.2 Implement rate limiting
    - Install django-ratelimit package
    - Add rate limiting to authentication endpoints (5 attempts per minute)
    - Add rate limiting to file upload endpoints (10 uploads per minute)
    - _Requirements: 28.6, 28.7_

  - [ ] 27.3 Implement input validation and sanitization
    - Use DRF serializers for all input validation
    - Add custom validators for complex business rules
    - Sanitize user input to prevent injection attacks
    - Sanitize filenames to prevent path traversal
    - _Requirements: 28.8, 28.9, 28.14, 28.15_

  - [ ]* 27.4 Write property tests for input validation
    - **Property 41: Input Validation and Sanitization**
    - **Validates: Requirements 28.8, 28.9, 28.14, 28.15**

  - [ ] 27.5 Implement authentication failure logging
    - Log all failed login attempts with username and IP
    - Log all authentication errors
    - _Requirements: 28.12_

  - [ ] 27.6 Implement account lockout
    - Lock account after 5 failed login attempts
    - Require admin unlock or time-based unlock (30 minutes)
    - _Requirements: 28.13_

  - [ ] 27.7 Implement Content-Security-Policy headers
    - Configure CSP headers for XSS protection
    - Set appropriate directives for React frontend
    - _Requirements: 28.17_

  - [ ] 27.8 Configure error handling middleware
    - Create custom exception handler for DRF
    - Return user-friendly error messages
    - Log all errors with stack traces
    - _Requirements: 29.1, 29.2, 29.11_

  - [ ] 27.9 Implement structured logging
    - Configure Python logging with JSON format
    - Set up separate log files: api.log, celery.log, channels.log
    - Configure log rotation
    - _Requirements: 29.1, 29.7, 29.9_

  - [ ] 27.10 Implement request logging
    - Log all API requests: method, path, status code, response time
    - Log user information for authenticated requests
    - _Requirements: 29.3_

  - [ ] 27.11 Implement database query logging (development only)
    - Enable query logging in development settings
    - Disable in production for performance
    - _Requirements: 29.4_

  - [ ] 27.12 Implement authentication attempt logging
    - Log all login attempts (success and failure)
    - Include username, IP address, timestamp
    - _Requirements: 29.5_

  - [ ] 27.13 Implement file upload operation logging
    - Log all file uploads with file type, size, user
    - _Requirements: 29.6_

  - [ ] 27.14 Implement graceful error handling
    - Handle database connection errors gracefully
    - Handle Redis connection errors gracefully
    - Return appropriate error responses without crashing
    - _Requirements: 29.14, 29.15_

  - [ ]* 27.15 Write property tests for error handling
    - **Property 45: Graceful Error Handling**
    - **Validates: Requirements 29.14, 29.15**
    - **Property 43: Error Logging**
    - **Validates: Requirements 29.2, 29.17**

  - [ ] 27.16 Configure error tracking integration
    - Add Sentry SDK (optional)
    - Configure Sentry DSN from environment
    - _Requirements: 29.16_

  - [ ] 27.17 Implement critical error notifications
    - Send notifications to admins on critical errors
    - _Requirements: 29.10_

  - [ ] 27.18 Implement environment-specific error messages
    - Detailed errors in development mode
    - Generic errors in production mode
    - _Requirements: 29.12, 29.13_

- [ ] 28. Django admin interface
  - [ ] 28.1 Register all models in Django admin
    - Register User, Cadet, Grades, TrainingStaff, Activity, etc.
    - Configure admin.site.register() for all 19 models
    - _Requirements: 25.2_

  - [ ] 28.2 Customize admin list displays
    - Configure list_display for relevant fields
    - Add list_filter for company, platoon, status, role
    - Add search_fields for cadets, users, staff
    - _Requirements: 25.3, 25.4, 25.5_

  - [ ] 28.3 Configure inline admin for related objects
    - Add GradesInline for Cadet admin
    - Add ActivityImageInline for Activity admin
    - _Requirements: 25.6_

  - [ ] 28.4 Restrict admin access to admin role
    - Override has_module_permission to check role
    - Ensure only users with role='admin' can access
    - _Requirements: 25.7_

  - [ ] 28.5 Implement bulk actions
    - Add bulk archive/unarchive actions
    - Add bulk approve actions for users
    - _Requirements: 25.8, 25.13_

  - [ ] 28.6 Customize admin forms
    - Configure fieldsets for proper field ordering
    - Set readonly_fields for system-generated data
    - _Requirements: 25.9, 25.10_

  - [ ] 28.7 Implement admin export actions
    - Add export to CSV action
    - Add export to Excel action
    - _Requirements: 25.11_

  - [ ] 28.8 Implement admin action logging
    - Log all admin actions in audit_logs
    - _Requirements: 25.12_

  - [ ] 28.9 Implement admin dashboard with statistics
    - Customize admin index page
    - Display record counts and key metrics
    - _Requirements: 25.14_

  - [ ] 28.10 Add admin documentation
    - Add help_text to model fields
    - Create admin documentation pages
    - _Requirements: 25.15_

- [ ] 29. API compatibility and response formatting
  - [ ] 29.1 Implement API response format standardization
    - Create custom renderer for consistent JSON format
    - Match Node.js response structure exactly
    - _Requirements: 24.2, 35.5_

  - [ ] 29.2 Implement HTTP status code consistency
    - Use 200 for success, 201 for creation
    - Use 400 for validation errors, 401 for auth errors
    - Use 403 for authorization errors, 404 for not found
    - Use 500 for server errors
    - _Requirements: 24.3, 38.1_

  - [ ]* 29.3 Write property tests for API compatibility
    - **Property 35: API Response Format Compatibility**
    - **Validates: Requirements 3.9, 4.12, 24.2, 24.5-24.9, 34.5-34.9**
    - **Property 38: HTTP Status Code Consistency**
    - **Validates: Requirements 24.3, 24.11**

  - [ ] 29.4 Implement pagination format consistency
    - Return page, limit, total fields
    - Match Node.js pagination structure
    - _Requirements: 24.9, 39.1_

  - [ ] 29.5 Implement date/time format consistency
    - Use ISO 8601 format for all timestamps
    - Match Node.js date formatting
    - _Requirements: 24.10_

  - [ ] 29.6 Implement boolean representation consistency
    - Use true/false (not 1/0) in JSON responses
    - _Requirements: 24.11_

  - [ ] 29.7 Implement error message format consistency
    - Match Node.js error response structure
    - Include error, message, code, details fields
    - _Requirements: 24.6, 40.1_

  - [ ]* 29.8 Write property tests for error responses
    - **Property 40: Error Message Format Consistency**
    - **Validates: Requirements 24.6, 29.11**

  - [ ] 29.9 Implement CORS header consistency
    - Ensure CORS headers match Node.js configuration
    - _Requirements: 36.1_

  - [ ]* 29.10 Write property tests for CORS
    - **Property 36: CORS Headers Present**
    - **Validates: Requirements 1.4, 24.3, 34.3**

  - [ ] 29.11 Implement API versioning
    - Add /api/v1/ prefix to all endpoints
    - Prepare for future API changes
    - _Requirements: 24.12_

  - [ ] 29.12 Document API differences from Node.js
    - Create API_DIFFERENCES.md file
    - Document any unavoidable differences
    - _Requirements: 24.14_

- [ ] 30. Performance optimization
  - [ ] 30.1 Configure database connection pooling
    - Set CONN_MAX_AGE for persistent connections
    - Configure minimum 5 connections in pool
    - _Requirements: 31.3, 31.15_

  - [ ] 30.2 Optimize ORM queries with select_related and prefetch_related
    - Add select_related for foreign keys (cadet.grades, user.settings)
    - Add prefetch_related for reverse relationships (cadet.merit_demerit_logs)
    - _Requirements: 31.4_

  - [ ] 30.3 Implement query optimization to avoid N+1 problems
    - Review all list endpoints for N+1 queries
    - Use select_related/prefetch_related appropriately
    - _Requirements: 31.9_

  - [ ] 30.4 Implement bulk operations
    - Use bulk_create for batch inserts
    - Use bulk_update for batch updates
    - _Requirements: 31.10_

  - [ ] 30.5 Implement database transactions
    - Use transaction.atomic() for multi-step operations
    - Ensure data consistency
    - _Requirements: 31.11_

  - [ ] 30.6 Configure response compression
    - Enable GZipMiddleware for response compression
    - _Requirements: 31.7_

  - [ ] 30.7 Implement pagination for all list endpoints
    - Set default page size to 50 items
    - Allow client to specify page size
    - _Requirements: 31.8_

  - [ ] 30.8 Configure gunicorn workers
    - Set worker count based on CPU cores (2 * cores + 1)
    - Configure worker timeout
    - _Requirements: 31.14_

  - [ ] 30.9 Implement query result caching
    - Cache expensive query results
    - Use Redis for cache storage
    - _Requirements: 31.16_

  - [ ] 30.10 Monitor and optimize slow queries
    - Review slow query logs
    - Add indexes where needed
    - _Requirements: 31.12_

  - [ ]* 30.11 Write performance tests
    - Test GET /api/cadets responds within 200ms for 100 cadets
    - Test GET /api/grades responds within 200ms for 100 records
    - _Requirements: 31.1, 31.2_

- [ ] 31. Checkpoint - Verify security and performance
  - Ensure security measures are in place, test performance benchmarks, verify error handling works correctly, ask the user if questions arise.

### Phase 7: Data Migration

- [ ] 32. Data migration scripts and validation
  - [ ] 32.1 Create data export script for Node.js database
    - Create scripts/export_nodejs_data.py
    - Export all 19 tables to JSON format
    - Preserve primary keys and foreign key relationships
    - Export in correct dependency order
    - Create backup of Legacy_Backend database
    - _Requirements: 23.1, 23.4, 23.9_

  - [ ] 32.2 Implement data validation before migration
    - Validate all foreign key references are valid
    - Validate required fields are present
    - Validate data types and constraints
    - Generate validation report
    - _Requirements: 23.5, 23.12_

  - [ ] 32.3 Create data import script for Django database
    - Create scripts/import_to_django.py
    - Import JSON data into Django_Backend database
    - Preserve all primary keys and foreign key relationships
    - Import tables in correct dependency order
    - _Requirements: 23.2, 23.3, 23.4_

  - [ ] 32.4 Preserve timestamps and special fields
    - Preserve all created_at timestamps exactly
    - Preserve all Cloudinary URLs without modification
    - Preserve all bcrypt password hashes
    - Handle NULL values and empty strings correctly
    - _Requirements: 23.6, 23.7, 23.8, 23.13_

  - [ ]* 32.5 Write property tests for data migration
    - **Property 34: Data Migration Preservation**
    - **Validates: Requirements 23.3, 23.6, 23.7, 23.8**

  - [ ] 32.6 Implement migration verification script
    - Create scripts/verify_migration.py
    - Compare record counts between Legacy_Backend and Django_Backend
    - Verify data integrity after migration
    - Validate all foreign key references
    - Generate migration report with record counts
    - _Requirements: 23.5, 23.11, 23.14_

  - [ ] 32.7 Implement rollback capability
    - Create scripts/rollback_migration.py
    - Provide rollback script to restore Legacy_Backend
    - Document rollback procedure step-by-step
    - _Requirements: 23.10, 33.3, 33.7_

  - [ ] 32.8 Implement incremental migration support
    - Support testing migration with subset of data
    - Support incremental data sync during transition
    - _Requirements: 23.15, 33.11_

  - [ ] 32.9 Create migration audit trail
    - Log all migration operations
    - Store migration timestamp and user
    - Generate detailed migration report
    - _Requirements: 23.16_

- [ ] 33. Checkpoint - Verify data migration
  - Run migration scripts, verify all data migrated correctly, compare record counts, validate data integrity, ask the user if questions arise.

### Phase 8: Deployment and Cutover

- [ ] 34. Render.com deployment configuration
  - [ ] 34.1 Create render.yaml configuration file
    - Configure web service for Django application
    - Configure PostgreSQL database connection
    - Configure Redis instance for caching and Celery
    - Configure Celery worker service
    - Configure environment variables
    - _Requirements: 27.1, 27.2, 27.3, 27.5, 27.8_

  - [ ] 34.2 Configure gunicorn WSGI server
    - Create gunicorn configuration file
    - Set worker count and timeout
    - Configure logging
    - _Requirements: 27.6, 30.8_

  - [ ] 34.3 Configure daphne ASGI server for WebSocket
    - Configure daphne for Django Channels
    - Set up ASGI application
    - Configure WebSocket routing
    - _Requirements: 27.7_

  - [ ] 34.4 Configure static file serving
    - Configure static file collection
    - Set up static file serving for React frontend
    - Configure STATIC_ROOT and STATIC_URL
    - _Requirements: 27.4_

  - [ ] 34.5 Configure production environment variables
    - Set DEBUG=False
    - Configure SECRET_KEY from environment
    - Configure ALLOWED_HOSTS for Render domain
    - Configure CORS_ALLOWED_ORIGINS for React frontend
    - Configure DATABASE_URL and REDIS_URL
    - _Requirements: 27.10, 27.11, 27.12, 27.13, 27.14, 27.15_

  - [ ] 34.6 Configure health check endpoints
    - Set up health check for Render monitoring
    - Configure /api/health endpoint
    - _Requirements: 27.9_

  - [ ] 34.7 Configure automatic database migrations
    - Add migration command to build process
    - Configure automatic migrations on deployment
    - _Requirements: 27.18_

  - [ ] 34.8 Create build and start commands
    - Configure build command for installing dependencies
    - Configure start command for running the server
    - _Requirements: 27.16, 27.17_

  - [ ] 34.9 Test deployment to Render staging environment
    - Deploy to staging environment
    - Verify all services start correctly
    - Test database connectivity
    - Test Redis connectivity
    - Test Celery workers
    - _Requirements: 33.9_

- [ ] 35. Frontend integration and testing
  - [ ] 35.1 Configure React frontend to use Django backend
    - Update API base URL configuration
    - Verify authentication token format compatibility
    - Test CORS configuration
    - _Requirements: 34.2, 34.3, 34.4_

  - [ ] 35.2 Run frontend integration tests
    - Test user login and authentication flow
    - Test cadet list and detail views
    - Test grade management features
    - Test attendance tracking features
    - Test messaging and notifications
    - Test file uploads
    - Test real-time updates via WebSocket
    - _Requirements: 34.1, 34.5-34.9, 34.11_

  - [ ] 35.3 Test mobile app compatibility
    - Test Android app with Django backend
    - Verify API compatibility
    - Test push notifications
    - Test offline sync
    - _Requirements: 32.1, 32.2, 32.5, 32.7, 32.8_

  - [ ] 35.4 Test desktop app compatibility
    - Test Electron app with Django backend
    - Verify all features work correctly
    - _Requirements: 32.1, 32.2_

  - [ ] 35.5 Document any frontend changes required
    - Create FRONTEND_CHANGES.md if needed
    - Document any adapter code required
    - _Requirements: 34.14, 34.15_

- [ ] 36. Production cutover and monitoring
  - [ ] 36.1 Create cutover plan
    - Document step-by-step cutover procedure
    - Define rollback triggers and procedures
    - Identify emergency contacts
    - _Requirements: 33.7, 33.13, 33.14, 33.15_

  - [ ] 36.2 Implement gradual traffic migration
    - Configure traffic splitting (10%, 50%, 100%)
    - Monitor error rates during migration
    - Support running Legacy_Backend and Django_Backend in parallel
    - _Requirements: 33.4, 33.8_

  - [ ] 36.3 Set up production monitoring
    - Configure error tracking (Sentry or similar)
    - Set up performance monitoring
    - Configure alerting for critical errors
    - Monitor database and Redis performance
    - _Requirements: 33.9, 33.10, 33.13_

  - [ ] 36.4 Perform final data synchronization
    - Sync any data changes during transition period
    - Verify data consistency between systems
    - _Requirements: 33.11, 33.12_

  - [ ] 36.5 Execute production cutover
    - Switch DNS/routing to Django backend
    - Monitor system health and error rates
    - Verify all features working in production
    - Keep Legacy_Backend available for rollback
    - _Requirements: 33.4, 33.8, 33.9_

  - [ ] 36.6 Post-cutover validation
    - Verify all users can log in
    - Verify all API endpoints responding correctly
    - Verify real-time updates working
    - Verify background tasks processing
    - Verify file uploads working
    - Monitor performance metrics
    - _Requirements: 34.11_

  - [ ] 36.7 Document lessons learned and known issues
    - Create post-migration report
    - Document any issues encountered
    - Document workarounds and solutions
    - _Requirements: 33.14_

- [ ] 37. Checkpoint - Final verification
  - Ensure production deployment successful, all features working, performance acceptable, no critical errors, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Data migration (Phase 7) is critical and must be thoroughly tested before production cutover
- Deployment (Phase 8) includes gradual rollout with rollback capability
- The migration maintains 100% API compatibility to avoid frontend changes

## Success Criteria

The migration will be considered successful when:

1. All 19 database tables replicated with identical schema
2. All existing data migrated without loss or corruption
3. All 100+ API endpoints functional and returning compatible responses
4. React frontend works without code changes
5. Mobile and desktop apps continue working
6. All authentication works with existing credentials
7. File uploads and Cloudinary integrations work correctly
8. Real-time updates via WebSocket work as expected
9. Background tasks via Celery execute successfully
10. Caching via Redis improves performance
11. System deploys successfully to Render.com
12. Performance matches or exceeds Node.js version
13. Zero data loss verified through validation
14. Rollback procedure tested and documented
15. All documentation complete and accurate
