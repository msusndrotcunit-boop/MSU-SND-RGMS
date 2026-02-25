# Requirements Document: ROTC Grading System Migration (Node.js to Django)

## Introduction

This document specifies the requirements for migrating the ROTC Grading System from a Node.js/Express/React stack to Python/Django while maintaining 100% feature parity, data model compatibility, and zero data loss. The migration must preserve all existing functionality, support the current React frontend with minimal changes, and maintain compatibility with mobile applications (Android via Capacitor) and desktop applications (Electron).

The current system serves three user roles (Admin, Cadet, Training Staff) with comprehensive features including user management, grading, attendance tracking, activities management, messaging, notifications, file uploads, real-time updates, and performance monitoring. The system currently runs on Render.com with PostgreSQL in production and SQLite for development.

## Glossary

- **Django_Backend**: The new Python/Django REST API server that will replace the Node.js/Express backend
- **Legacy_Backend**: The current Node.js/Express backend being replaced
- **React_Frontend**: The existing React 18.2.0 single-page application that must continue working
- **Database_Schema**: The exact table structure, column names, and relationships that must be preserved
- **API_Contract**: The HTTP endpoints, request/response formats, and authentication mechanisms
- **Migration_Script**: Python scripts that transfer data from Legacy_Backend database to Django_Backend database
- **Cadet**: A student enrolled in the ROTC program with a user account
- **Training_Staff**: Instructors and staff members who manage cadets and training activities
- **Admin**: System administrators with full access to all features
- **Merit_Demerit_System**: Point-based grading system for cadet behavior and performance
- **Training_Day**: A scheduled ROTC training session requiring attendance tracking
- **Excuse_Letter**: A document submitted by cadets to justify absences
- **SSE**: Server-Sent Events for real-time updates in the current system
- **Django_Channels**: WebSocket/async framework for Django to replace SSE functionality
- **Celery**: Distributed task queue for background jobs in Django
- **Redis**: In-memory data store used for caching and Celery message broker
- **Cloudinary**: Cloud-based image and file storage service
- **ROTCMIS**: External ROTC Management Information System for data import/export
- **QR_Code_Scanner**: Feature allowing attendance check-in via QR codes
- **PWA**: Progressive Web App with offline capabilities and service workers
- **Render_Platform**: Cloud hosting platform (Render.com) where the system is deployed

## Requirements

### Requirement 1: Django Project Foundation

**User Story:** As a developer, I want a properly configured Django project with all necessary dependencies, so that I can build the migration on a solid foundation.

#### Acceptance Criteria

1. THE Django_Backend SHALL use Python 3.11 or higher
2. THE Django_Backend SHALL use Django 5.0 or higher with Django REST Framework
3. THE Django_Backend SHALL support both SQLite (development) and PostgreSQL (production) databases
4. THE Django_Backend SHALL include django-cors-headers configured to accept requests from React_Frontend
5. THE Django_Backend SHALL include all required dependencies: django-storages, Pillow, ReportLab, pytesseract, celery, redis, django-channels, django-push-notifications
6. THE Django_Backend SHALL use the same environment variable names as Legacy_Backend for configuration
7. THE Django_Backend SHALL include a requirements.txt file with pinned versions for all dependencies
8. THE Django_Backend SHALL configure Django settings to work on Render_Platform with PostgreSQL
9. THE Django_Backend SHALL include separate settings files for development and production environments
10. THE Django_Backend SHALL configure static file serving compatible with React_Frontend build output


### Requirement 2: Database Schema Preservation

**User Story:** As a system administrator, I want the Django database models to exactly match the current schema, so that data migration is seamless and no data is lost.

#### Acceptance Criteria

1. THE Django_Backend SHALL create models for all 19 tables: cadets, users, grades, activities, merit_demerit_logs, training_days, attendance_records, excuse_letters, system_settings, training_staff, staff_attendance_records, notifications, staff_messages, user_settings, push_subscriptions, admin_messages, activity_images, audit_logs, sync_events
2. THE Django_Backend SHALL use identical table names as Database_Schema (no Django default pluralization)
3. THE Django_Backend SHALL use identical column names as Database_Schema (snake_case preserved)
4. THE Django_Backend SHALL preserve all foreign key relationships with ON DELETE CASCADE and ON DELETE SET NULL behaviors
5. THE Django_Backend SHALL preserve all CHECK constraints (e.g., role IN ('admin', 'cadet', 'training_staff'))
6. THE Django_Backend SHALL preserve all UNIQUE constraints (e.g., student_id, username, email)
7. THE Django_Backend SHALL preserve all default values (e.g., status='Ongoing', is_archived=FALSE)
8. THE Django_Backend SHALL use SERIAL/AutoField for all id columns matching PostgreSQL behavior
9. THE Django_Backend SHALL preserve all indexes created in Database_Schema
10. THE Django_Backend SHALL support JSONB fields for payload columns in audit_logs and sync_events tables
11. THE Django_Backend SHALL preserve DOUBLE PRECISION fields for latitude/longitude columns
12. THE Django_Backend SHALL preserve TIMESTAMP fields with DEFAULT CURRENT_TIMESTAMP behavior


### Requirement 3: Authentication System Migration

**User Story:** As a user, I want to log in with my existing credentials, so that I can access the system without creating a new account.

#### Acceptance Criteria

1. THE Django_Backend SHALL authenticate users using bcrypt password hashing compatible with bcryptjs from Legacy_Backend
2. WHEN a user submits valid credentials, THE Django_Backend SHALL return a JWT token or session token compatible with React_Frontend expectations
3. THE Django_Backend SHALL validate existing password hashes created by Legacy_Backend without requiring password resets
4. THE Django_Backend SHALL support token-based authentication for API requests
5. THE Django_Backend SHALL implement role-based access control for 'admin', 'cadet', and 'training_staff' roles
6. THE Django_Backend SHALL preserve the is_approved field logic for user account approval
7. THE Django_Backend SHALL maintain the relationship between users and cadets via cadet_id foreign key
8. THE Django_Backend SHALL maintain the relationship between users and training_staff via staff_id foreign key
9. THE Django_Backend SHALL return user profile data in the same JSON format as Legacy_Backend
10. THE Django_Backend SHALL support logout functionality that invalidates tokens
11. WHEN a user registers, THE Django_Backend SHALL create user records with is_approved=0 by default
12. THE Django_Backend SHALL preserve location tracking fields (last_latitude, last_longitude, last_location_at)


### Requirement 4: Cadet Management API

**User Story:** As an admin, I want to manage cadet records through the API, so that I can perform CRUD operations on cadet data.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/cadets endpoint returning all non-archived cadets
2. THE Django_Backend SHALL provide GET /api/cadets/:id endpoint returning a single cadet with grades
3. THE Django_Backend SHALL provide POST /api/cadets endpoint creating new cadet records
4. THE Django_Backend SHALL provide PUT /api/cadets/:id endpoint updating existing cadet records
5. THE Django_Backend SHALL provide DELETE /api/cadets/:id endpoint for soft-deleting cadets (is_archived=TRUE)
6. THE Django_Backend SHALL provide GET /api/cadets/archived endpoint returning archived cadets
7. THE Django_Backend SHALL provide POST /api/cadets/:id/restore endpoint for unarchiving cadets
8. THE Django_Backend SHALL validate required fields: first_name, last_name, student_id
9. THE Django_Backend SHALL enforce UNIQUE constraint on student_id field
10. THE Django_Backend SHALL support filtering cadets by company, platoon, course, year_level, status
11. THE Django_Backend SHALL support searching cadets by name or student_id
12. THE Django_Backend SHALL return cadet data with associated grades in the same JSON format as Legacy_Backend
13. THE Django_Backend SHALL track is_profile_completed status for cadets
14. THE Django_Backend SHALL support profile picture uploads via profile_pic field
15. WHEN a cadet is created, THE Django_Backend SHALL automatically create a corresponding grades record


### Requirement 5: Grading System API

**User Story:** As an admin, I want to manage cadet grades and merit/demerit points, so that I can track cadet performance accurately.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/grades endpoint returning all grades with cadet information
2. THE Django_Backend SHALL provide GET /api/grades/:cadet_id endpoint returning grades for a specific cadet
3. THE Django_Backend SHALL provide PUT /api/grades/:cadet_id endpoint updating grade fields
4. THE Django_Backend SHALL support updating attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score fields
5. THE Django_Backend SHALL provide POST /api/merit-demerit endpoint for adding merit/demerit log entries
6. THE Django_Backend SHALL provide GET /api/merit-demerit/:cadet_id endpoint returning merit/demerit history
7. THE Django_Backend SHALL provide DELETE /api/merit-demerit/:id endpoint for removing log entries
8. THE Django_Backend SHALL automatically update grades.merit_points when merit logs are added
9. THE Django_Backend SHALL automatically update grades.demerit_points when demerit logs are added
10. THE Django_Backend SHALL track issued_by_user_id and issued_by_name for merit/demerit logs
11. THE Django_Backend SHALL validate that points are positive integers
12. THE Django_Backend SHALL validate that type is either 'merit' or 'demerit'
13. THE Django_Backend SHALL record date_recorded timestamp automatically
14. WHEN merit/demerit logs are modified, THE Django_Backend SHALL create audit_logs entries
15. WHEN merit/demerit logs are modified, THE Django_Backend SHALL create sync_events entries for real-time updates


### Requirement 6: Attendance Tracking System

**User Story:** As a training staff member, I want to track cadet attendance for training days, so that I can monitor participation and update attendance records.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/training-days endpoint returning all training days
2. THE Django_Backend SHALL provide POST /api/training-days endpoint creating new training days
3. THE Django_Backend SHALL provide PUT /api/training-days/:id endpoint updating training day details
4. THE Django_Backend SHALL provide DELETE /api/training-days/:id endpoint removing training days
5. THE Django_Backend SHALL provide GET /api/attendance/:training_day_id endpoint returning attendance records for a training day
6. THE Django_Backend SHALL provide POST /api/attendance endpoint creating attendance records
7. THE Django_Backend SHALL provide PUT /api/attendance/:id endpoint updating attendance status
8. THE Django_Backend SHALL enforce UNIQUE constraint on (training_day_id, cadet_id) pairs
9. THE Django_Backend SHALL validate status values: 'present', 'absent', 'late', 'excused'
10. THE Django_Backend SHALL support time_in and time_out fields for attendance records
11. THE Django_Backend SHALL provide GET /api/staff-attendance/:training_day_id endpoint for staff attendance
12. THE Django_Backend SHALL provide POST /api/staff-attendance endpoint creating staff attendance records
13. THE Django_Backend SHALL enforce UNIQUE constraint on (training_day_id, staff_id) pairs
14. WHEN attendance status is 'present', THE Django_Backend SHALL increment grades.attendance_present
15. THE Django_Backend SHALL support QR code-based attendance check-in via dedicated endpoint
16. THE Django_Backend SHALL support bulk attendance creation for all cadets in a training day


### Requirement 7: File Upload and Cloudinary Integration

**User Story:** As a user, I want to upload files and images, so that I can submit excuse letters, profile pictures, and activity images.

#### Acceptance Criteria

1. THE Django_Backend SHALL integrate with Cloudinary using django-storages for file uploads
2. THE Django_Backend SHALL provide POST /api/upload endpoint accepting multipart/form-data
3. THE Django_Backend SHALL support image uploads for profile pictures (cadets, users, training_staff)
4. THE Django_Backend SHALL support document uploads for excuse letters (PDF, DOCX, images)
5. THE Django_Backend SHALL support multiple image uploads for activities
6. THE Django_Backend SHALL use the same Cloudinary configuration (cloud_name, api_key, api_secret) as Legacy_Backend
7. THE Django_Backend SHALL return Cloudinary URLs in the same format as Legacy_Backend
8. THE Django_Backend SHALL validate file types and sizes before upload
9. THE Django_Backend SHALL compress images using Pillow before uploading to Cloudinary
10. THE Django_Backend SHALL store Cloudinary URLs in database fields (profile_pic, file_url, image_path)
11. THE Django_Backend SHALL support deleting files from Cloudinary when records are deleted
12. THE Django_Backend SHALL preserve existing Cloudinary URLs during data migration
13. WHEN an activity image is uploaded, THE Django_Backend SHALL create an activity_images record
14. THE Django_Backend SHALL support the images TEXT field for storing multiple image URLs as JSON


### Requirement 8: Excuse Letter Management

**User Story:** As a cadet, I want to submit excuse letters for absences, so that I can justify my absence and request approval.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/excuse-letters endpoint returning all excuse letters
2. THE Django_Backend SHALL provide GET /api/excuse-letters/cadet/:cadet_id endpoint returning letters for a specific cadet
3. THE Django_Backend SHALL provide POST /api/excuse-letters endpoint creating new excuse letter submissions
4. THE Django_Backend SHALL provide PUT /api/excuse-letters/:id endpoint updating excuse letter status
5. THE Django_Backend SHALL provide DELETE /api/excuse-letters/:id endpoint removing excuse letters
6. THE Django_Backend SHALL validate required fields: cadet_id, date_absent, reason
7. THE Django_Backend SHALL support file_url field for uploaded excuse letter documents
8. THE Django_Backend SHALL validate status values: 'pending', 'approved', 'rejected'
9. THE Django_Backend SHALL set status='pending' by default for new submissions
10. THE Django_Backend SHALL record created_at timestamp automatically
11. THE Django_Backend SHALL support filtering excuse letters by status
12. WHEN an excuse letter is approved, THE Django_Backend SHALL update corresponding attendance_records status to 'excused'
13. THE Django_Backend SHALL link excuse letters to training_days via training_day_id foreign key
14. THE Django_Backend SHALL support OCR processing of uploaded excuse letter images using pytesseract


### Requirement 9: Activities and Achievements Management

**User Story:** As an admin, I want to manage activities and achievements, so that I can showcase ROTC events and cadet accomplishments.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/activities endpoint returning all activities
2. THE Django_Backend SHALL provide GET /api/activities/:id endpoint returning a single activity with images
3. THE Django_Backend SHALL provide POST /api/activities endpoint creating new activities
4. THE Django_Backend SHALL provide PUT /api/activities/:id endpoint updating activities
5. THE Django_Backend SHALL provide DELETE /api/activities/:id endpoint removing activities
6. THE Django_Backend SHALL support required fields: title, description, date
7. THE Django_Backend SHALL support optional fields: image_path, images, type
8. THE Django_Backend SHALL support type field with values: 'activity', 'achievement', 'event'
9. THE Django_Backend SHALL support multiple images via activity_images table relationship
10. THE Django_Backend SHALL return activities with associated images in nested JSON format
11. THE Django_Backend SHALL support filtering activities by type and date range
12. THE Django_Backend SHALL support pagination for activities list
13. WHEN an activity is deleted, THE Django_Backend SHALL cascade delete associated activity_images records
14. THE Django_Backend SHALL support generating PDF certificates for achievements using ReportLab
15. THE Django_Backend SHALL provide GET /api/activities/:id/certificate endpoint for PDF generation


### Requirement 10: Training Staff Management

**User Story:** As an admin, I want to manage training staff profiles, so that I can maintain accurate staff records and track their information.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/staff endpoint returning all non-archived training staff
2. THE Django_Backend SHALL provide GET /api/staff/:id endpoint returning a single staff member
3. THE Django_Backend SHALL provide POST /api/staff endpoint creating new staff records
4. THE Django_Backend SHALL provide PUT /api/staff/:id endpoint updating staff records
5. THE Django_Backend SHALL provide DELETE /api/staff/:id endpoint for soft-deleting staff (is_archived=TRUE)
6. THE Django_Backend SHALL validate required fields: first_name, last_name, email
7. THE Django_Backend SHALL enforce UNIQUE constraint on email field
8. THE Django_Backend SHALL support all profile fields: rank, middle_name, suffix_name, contact_number, role, profile_pic, afpsn, birthdate, birthplace, age, height, weight, blood_type, address, civil_status, nationality, gender, language_spoken, combat_boots_size, uniform_size, bullcap_size, facebook_link, rotc_unit, mobilization_center
9. THE Django_Backend SHALL track is_profile_completed and has_seen_guide status
10. THE Django_Backend SHALL record created_at timestamp automatically
11. THE Django_Backend SHALL support filtering staff by role
12. THE Django_Backend SHALL return staff data with associated user account information
13. WHEN a staff member is created, THE Django_Backend SHALL optionally create a corresponding user account
14. THE Django_Backend SHALL support profile picture uploads for staff members


### Requirement 11: Messaging System

**User Story:** As a user, I want to send and receive messages, so that I can communicate with admins and other staff members.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/messages/admin endpoint returning admin messages for the current user
2. THE Django_Backend SHALL provide POST /api/messages/admin endpoint creating new admin messages
3. THE Django_Backend SHALL provide PUT /api/messages/admin/:id endpoint for admins to reply to messages
4. THE Django_Backend SHALL provide GET /api/messages/staff endpoint returning staff chat messages
5. THE Django_Backend SHALL provide POST /api/messages/staff endpoint creating new staff messages
6. THE Django_Backend SHALL validate required fields for admin_messages: subject, message
7. THE Django_Backend SHALL validate required fields for staff_messages: content
8. THE Django_Backend SHALL support status field for admin_messages: 'pending', 'replied'
9. THE Django_Backend SHALL support admin_reply field for admin responses
10. THE Django_Backend SHALL record created_at timestamp automatically for all messages
11. THE Django_Backend SHALL link admin_messages to users via user_id foreign key
12. THE Django_Backend SHALL link staff_messages to training_staff via sender_staff_id foreign key
13. THE Django_Backend SHALL support filtering admin messages by status
14. THE Django_Backend SHALL return messages in chronological order
15. WHEN a new message is created, THE Django_Backend SHALL create a notification for the recipient


### Requirement 12: Notification System

**User Story:** As a user, I want to receive notifications about important events, so that I stay informed about grade changes, messages, and system updates.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/notifications endpoint returning notifications for the current user
2. THE Django_Backend SHALL provide POST /api/notifications endpoint creating new notifications
3. THE Django_Backend SHALL provide PUT /api/notifications/:id/read endpoint marking notifications as read
4. THE Django_Backend SHALL provide DELETE /api/notifications/:id endpoint removing notifications
5. THE Django_Backend SHALL validate required fields: message, type
6. THE Django_Backend SHALL support type field for categorizing notifications
7. THE Django_Backend SHALL set is_read=FALSE by default for new notifications
8. THE Django_Backend SHALL record created_at timestamp automatically
9. THE Django_Backend SHALL link notifications to users via user_id foreign key
10. THE Django_Backend SHALL support filtering notifications by is_read status
11. THE Django_Backend SHALL return unread notification count via GET /api/notifications/unread/count endpoint
12. THE Django_Backend SHALL support push notifications using django-push-notifications
13. THE Django_Backend SHALL provide POST /api/push/subscribe endpoint for registering push subscriptions
14. THE Django_Backend SHALL store push subscription data in push_subscriptions table
15. WHEN a notification is created, THE Django_Backend SHALL send push notification to subscribed devices
16. THE Django_Backend SHALL support web push notifications compatible with React_Frontend PWA


### Requirement 13: Real-time Updates with Django Channels

**User Story:** As a user, I want to receive real-time updates when grades change, so that I see current information without refreshing the page.

#### Acceptance Criteria

1. THE Django_Backend SHALL implement WebSocket support using Django_Channels
2. THE Django_Backend SHALL provide WebSocket endpoint at /ws/updates/ for real-time connections
3. THE Django_Backend SHALL use Redis as the channel layer backend
4. WHEN merit/demerit points are updated, THE Django_Backend SHALL broadcast updates via WebSocket
5. WHEN attendance records are updated, THE Django_Backend SHALL broadcast updates via WebSocket
6. WHEN exam scores are updated, THE Django_Backend SHALL broadcast updates via WebSocket
7. THE Django_Backend SHALL authenticate WebSocket connections using the same token mechanism as HTTP API
8. THE Django_Backend SHALL send updates only to authorized users based on their role
9. THE Django_Backend SHALL format WebSocket messages compatible with React_Frontend expectations
10. THE Django_Backend SHALL maintain backward compatibility with SSE by providing GET /api/events endpoint
11. THE Django_Backend SHALL create sync_events records for all grade-related changes
12. THE Django_Backend SHALL process sync_events and broadcast them via WebSocket
13. THE Django_Backend SHALL mark sync_events as processed after broadcasting
14. THE Django_Backend SHALL support reconnection and message replay for disconnected clients
15. THE Django_Backend SHALL handle WebSocket connection errors gracefully


### Requirement 14: Background Task Processing with Celery

**User Story:** As a system administrator, I want long-running tasks to execute in the background, so that API responses remain fast and the system stays responsive.

#### Acceptance Criteria

1. THE Django_Backend SHALL integrate Celery for background task processing
2. THE Django_Backend SHALL use Redis as the Celery message broker
3. THE Django_Backend SHALL process image compression as a background task
4. THE Django_Backend SHALL process PDF generation as a background task
5. THE Django_Backend SHALL process OCR document scanning as a background task
6. THE Django_Backend SHALL process bulk data imports as background tasks
7. THE Django_Backend SHALL process email notifications as background tasks
8. THE Django_Backend SHALL provide task status endpoints for monitoring background jobs
9. THE Django_Backend SHALL retry failed tasks with exponential backoff
10. THE Django_Backend SHALL log task execution results for debugging
11. THE Django_Backend SHALL support scheduled periodic tasks for data cleanup
12. THE Django_Backend SHALL support scheduled periodic tasks for report generation
13. WHEN a background task fails, THE Django_Backend SHALL create a notification for admins
14. THE Django_Backend SHALL limit concurrent task execution to prevent resource exhaustion
15. THE Django_Backend SHALL provide Celery worker health check endpoint


### Requirement 15: Caching System with Redis

**User Story:** As a system administrator, I want frequently accessed data to be cached, so that database load is reduced and response times improve.

#### Acceptance Criteria

1. THE Django_Backend SHALL use Redis for caching frequently accessed data
2. THE Django_Backend SHALL cache cadet lists with 5-minute TTL
3. THE Django_Backend SHALL cache grade summaries with 5-minute TTL
4. THE Django_Backend SHALL cache training day lists with 10-minute TTL
5. THE Django_Backend SHALL cache system settings with 30-minute TTL
6. THE Django_Backend SHALL invalidate cache when related data is updated
7. THE Django_Backend SHALL provide cache statistics endpoint at /api/cache/stats
8. THE Django_Backend SHALL support cache warming for frequently accessed data
9. THE Django_Backend SHALL use cache keys compatible with Legacy_Backend NodeCache keys
10. THE Django_Backend SHALL fall back to database queries when cache is unavailable
11. THE Django_Backend SHALL cache API responses for read-only endpoints
12. WHEN a cadet is updated, THE Django_Backend SHALL invalidate related cache entries
13. WHEN grades are updated, THE Django_Backend SHALL invalidate related cache entries
14. THE Django_Backend SHALL provide cache clear endpoint for admins
15. THE Django_Backend SHALL monitor cache hit/miss ratios for performance tuning


### Requirement 16: Data Import/Export and ROTCMIS Integration

**User Story:** As an admin, I want to import and export data in various formats, so that I can integrate with external systems and backup data.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide POST /api/import/rotcmis endpoint for importing ROTCMIS data
2. THE Django_Backend SHALL provide GET /api/export/excel endpoint for exporting data to Excel format
3. THE Django_Backend SHALL provide GET /api/export/csv endpoint for exporting data to CSV format
4. THE Django_Backend SHALL use openpyxl or xlsxwriter for Excel file generation
5. THE Django_Backend SHALL support importing cadet data from ROTCMIS JSON format
6. THE Django_Backend SHALL validate imported data before inserting into database
7. THE Django_Backend SHALL provide import status and error reporting
8. THE Django_Backend SHALL support exporting cadets, grades, attendance, and activities
9. THE Django_Backend SHALL support filtering exported data by date range, company, platoon
10. THE Django_Backend SHALL generate Excel files with proper formatting and headers
11. THE Django_Backend SHALL process large imports as background tasks using Celery
12. THE Django_Backend SHALL preserve existing data during imports (no overwrites without confirmation)
13. WHEN import errors occur, THE Django_Backend SHALL return detailed error messages
14. THE Django_Backend SHALL support bulk update operations via CSV import
15. THE Django_Backend SHALL log all import/export operations in audit_logs


### Requirement 17: User Settings and Preferences

**User Story:** As a user, I want to customize my application settings, so that I can personalize my experience.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/settings endpoint returning user settings
2. THE Django_Backend SHALL provide PUT /api/settings endpoint updating user preferences
3. THE Django_Backend SHALL support email_alerts boolean preference
4. THE Django_Backend SHALL support push_notifications boolean preference
5. THE Django_Backend SHALL support activity_updates boolean preference
6. THE Django_Backend SHALL support dark_mode boolean preference
7. THE Django_Backend SHALL support compact_mode boolean preference
8. THE Django_Backend SHALL support primary_color text preference
9. THE Django_Backend SHALL support custom_bg text preference for custom backgrounds
10. THE Django_Backend SHALL create default settings when a user is created
11. THE Django_Backend SHALL link user_settings to users via user_id foreign key
12. THE Django_Backend SHALL validate primary_color values against allowed color list
13. THE Django_Backend SHALL return settings in the same JSON format as Legacy_Backend
14. WHEN settings are updated, THE Django_Backend SHALL invalidate related cache entries
15. THE Django_Backend SHALL support resetting settings to defaults


### Requirement 18: System Settings Management

**User Story:** As an admin, I want to configure system-wide settings, so that I can control application behavior and features.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/system-settings endpoint returning all system settings
2. THE Django_Backend SHALL provide GET /api/system-settings/:key endpoint returning a specific setting
3. THE Django_Backend SHALL provide PUT /api/system-settings/:key endpoint updating settings
4. THE Django_Backend SHALL store settings as key-value pairs in system_settings table
5. THE Django_Backend SHALL enforce UNIQUE constraint on key field
6. THE Django_Backend SHALL support settings for: school_year, semester, current_battalion, maintenance_mode
7. THE Django_Backend SHALL cache system settings with 30-minute TTL
8. THE Django_Backend SHALL restrict system settings access to admin role only
9. THE Django_Backend SHALL validate setting values based on key type
10. THE Django_Backend SHALL return settings in the same JSON format as Legacy_Backend
11. WHEN system settings are updated, THE Django_Backend SHALL invalidate cache
12. WHEN system settings are updated, THE Django_Backend SHALL broadcast changes via WebSocket
13. THE Django_Backend SHALL provide default values for required system settings
14. THE Django_Backend SHALL log system setting changes in audit_logs
15. THE Django_Backend SHALL support bulk update of multiple settings


### Requirement 19: Audit Logging and Sync Events

**User Story:** As a system administrator, I want to track all data changes, so that I can audit system activity and debug issues.

#### Acceptance Criteria

1. THE Django_Backend SHALL create audit_logs entries for all CREATE, UPDATE, DELETE operations
2. THE Django_Backend SHALL record table_name, operation, record_id, user_id in audit logs
3. THE Django_Backend SHALL store operation payload as JSONB in audit_logs
4. THE Django_Backend SHALL record created_at timestamp automatically
5. THE Django_Backend SHALL provide GET /api/audit-logs endpoint for admins
6. THE Django_Backend SHALL support filtering audit logs by table_name, operation, user_id, date range
7. THE Django_Backend SHALL create sync_events entries for grade-related changes
8. THE Django_Backend SHALL record event_type, cadet_id, payload in sync events
9. THE Django_Backend SHALL mark sync_events as processed after broadcasting
10. THE Django_Backend SHALL provide GET /api/sync-events endpoint for debugging
11. THE Django_Backend SHALL automatically create audit logs using Django signals
12. THE Django_Backend SHALL exclude sensitive fields (passwords) from audit log payloads
13. THE Django_Backend SHALL support audit log retention policies
14. WHEN merit/demerit logs are modified, THE Django_Backend SHALL create both audit_logs and sync_events
15. THE Django_Backend SHALL provide audit log export functionality for compliance


### Requirement 20: Performance Monitoring and Metrics

**User Story:** As a system administrator, I want to monitor system performance, so that I can identify bottlenecks and optimize the application.

#### Acceptance Criteria

1. THE Django_Backend SHALL provide GET /api/metrics endpoint returning performance metrics
2. THE Django_Backend SHALL track request count, response times, error rates
3. THE Django_Backend SHALL track database query count and execution times
4. THE Django_Backend SHALL track cache hit/miss ratios
5. THE Django_Backend SHALL track active user sessions
6. THE Django_Backend SHALL provide GET /api/health endpoint for health checks
7. THE Django_Backend SHALL provide GET /api/metrics/database endpoint for database statistics
8. THE Django_Backend SHALL provide GET /api/metrics/cache endpoint for cache statistics
9. THE Django_Backend SHALL use Django middleware for request/response timing
10. THE Django_Backend SHALL log slow queries (>100ms) for optimization
11. THE Django_Backend SHALL provide memory usage and CPU metrics
12. THE Django_Backend SHALL support Prometheus-compatible metrics export
13. THE Django_Backend SHALL restrict metrics endpoints to admin role only
14. THE Django_Backend SHALL return metrics in the same JSON format as Legacy_Backend
15. THE Django_Backend SHALL support custom performance alerts via notifications


### Requirement 21: PDF Generation and Reporting

**User Story:** As an admin, I want to generate PDF reports and certificates, so that I can provide official documents to cadets and staff.

#### Acceptance Criteria

1. THE Django_Backend SHALL use ReportLab for PDF generation
2. THE Django_Backend SHALL provide GET /api/reports/cadet/:id endpoint generating cadet profile PDFs
3. THE Django_Backend SHALL provide GET /api/reports/grades endpoint generating grade reports
4. THE Django_Backend SHALL provide GET /api/reports/attendance endpoint generating attendance reports
5. THE Django_Backend SHALL provide GET /api/certificates/:activity_id endpoint generating achievement certificates
6. THE Django_Backend SHALL support PDF customization with school logos and headers
7. THE Django_Backend SHALL generate PDFs with proper formatting, tables, and charts
8. THE Django_Backend SHALL process PDF generation as background tasks for large reports
9. THE Django_Backend SHALL support filtering reports by date range, company, platoon
10. THE Django_Backend SHALL return PDF files with proper Content-Type headers
11. THE Django_Backend SHALL cache generated PDFs for 1 hour
12. THE Django_Backend SHALL support PDF templates for consistent formatting
13. WHEN a PDF is generated, THE Django_Backend SHALL log the operation in audit_logs
14. THE Django_Backend SHALL support batch PDF generation for multiple cadets
15. THE Django_Backend SHALL include QR codes in certificates for verification


### Requirement 22: OCR Document Processing

**User Story:** As a system, I want to extract text from uploaded documents, so that I can process excuse letters and forms automatically.

#### Acceptance Criteria

1. THE Django_Backend SHALL use pytesseract for OCR text extraction
2. THE Django_Backend SHALL provide POST /api/ocr/process endpoint accepting image uploads
3. THE Django_Backend SHALL extract text from excuse letter images
4. THE Django_Backend SHALL extract text from scanned forms and documents
5. THE Django_Backend SHALL support image formats: JPEG, PNG, PDF
6. THE Django_Backend SHALL preprocess images for better OCR accuracy (contrast, rotation)
7. THE Django_Backend SHALL process OCR as a background task using Celery
8. THE Django_Backend SHALL return extracted text in JSON format
9. THE Django_Backend SHALL handle OCR errors gracefully with fallback messages
10. THE Django_Backend SHALL validate that Tesseract is installed and configured
11. THE Django_Backend SHALL support multiple languages for OCR (English, Filipino)
12. THE Django_Backend SHALL cache OCR results to avoid reprocessing
13. WHEN OCR processing fails, THE Django_Backend SHALL log the error and notify admins
14. THE Django_Backend SHALL provide OCR confidence scores in the response
15. THE Django_Backend SHALL support batch OCR processing for multiple documents


### Requirement 23: Data Migration Scripts

**User Story:** As a system administrator, I want to migrate all existing data from the Node.js system to Django, so that no data is lost during the transition.

#### Acceptance Criteria

1. THE Migration_Script SHALL export all data from Legacy_Backend database to JSON format
2. THE Migration_Script SHALL import JSON data into Django_Backend database
3. THE Migration_Script SHALL preserve all primary keys and foreign key relationships
4. THE Migration_Script SHALL migrate all 19 tables in correct dependency order
5. THE Migration_Script SHALL validate data integrity after migration
6. THE Migration_Script SHALL preserve all timestamps and dates exactly
7. THE Migration_Script SHALL preserve all Cloudinary URLs without modification
8. THE Migration_Script SHALL preserve all bcrypt password hashes
9. THE Migration_Script SHALL create a backup of Legacy_Backend database before migration
10. THE Migration_Script SHALL provide rollback capability if migration fails
11. THE Migration_Script SHALL generate a migration report with record counts
12. THE Migration_Script SHALL validate that all foreign key references are valid
13. THE Migration_Script SHALL handle NULL values and empty strings correctly
14. WHEN migration completes, THE Migration_Script SHALL verify data consistency
15. THE Migration_Script SHALL support incremental migration for testing
16. THE Migration_Script SHALL log all migration operations for audit trail


### Requirement 24: API Compatibility Layer

**User Story:** As a frontend developer, I want the Django API to match the Node.js API, so that the React frontend works without code changes.

#### Acceptance Criteria

1. THE Django_Backend SHALL use identical URL patterns as Legacy_Backend API
2. THE Django_Backend SHALL return JSON responses in identical format as Legacy_Backend
3. THE Django_Backend SHALL use identical HTTP status codes as Legacy_Backend
4. THE Django_Backend SHALL accept identical request body formats as Legacy_Backend
5. THE Django_Backend SHALL use identical query parameter names as Legacy_Backend
6. THE Django_Backend SHALL return identical error message formats as Legacy_Backend
7. THE Django_Backend SHALL use identical authentication header format as Legacy_Backend
8. THE Django_Backend SHALL support all 100+ endpoints from Legacy_Backend
9. THE Django_Backend SHALL maintain identical pagination format (page, limit, total)
10. THE Django_Backend SHALL maintain identical date/time format (ISO 8601)
11. THE Django_Backend SHALL maintain identical boolean representation (true/false, not 1/0)
12. THE Django_Backend SHALL provide API versioning for future changes
13. WHEN API responses differ from Legacy_Backend, THE Django_Backend SHALL provide compatibility shim
14. THE Django_Backend SHALL document any unavoidable API differences
15. THE Django_Backend SHALL pass all existing frontend integration tests


### Requirement 25: Django Admin Interface

**User Story:** As an admin, I want a Django admin interface, so that I can manage data directly through a web interface.

#### Acceptance Criteria

1. THE Django_Backend SHALL enable Django admin interface at /admin/ URL
2. THE Django_Backend SHALL register all models in Django admin
3. THE Django_Backend SHALL customize admin list displays with relevant fields
4. THE Django_Backend SHALL provide search functionality for cadets, users, staff
5. THE Django_Backend SHALL provide filtering by company, platoon, status, role
6. THE Django_Backend SHALL display related objects inline (grades with cadets)
7. THE Django_Backend SHALL restrict admin access to users with admin role
8. THE Django_Backend SHALL provide bulk actions for common operations
9. THE Django_Backend SHALL customize admin forms with proper field ordering
10. THE Django_Backend SHALL display read-only fields for system-generated data
11. THE Django_Backend SHALL provide export actions for data download
12. THE Django_Backend SHALL log all admin actions in audit_logs
13. THE Django_Backend SHALL support custom admin actions for bulk operations
14. THE Django_Backend SHALL display record counts and statistics in admin dashboard
15. THE Django_Backend SHALL provide admin documentation for models and fields


### Requirement 26: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive tests, so that I can verify the Django system works correctly.

#### Acceptance Criteria

1. THE Django_Backend SHALL include unit tests for all models
2. THE Django_Backend SHALL include unit tests for all API endpoints
3. THE Django_Backend SHALL include integration tests for authentication flow
4. THE Django_Backend SHALL include integration tests for grade calculation
5. THE Django_Backend SHALL include integration tests for file uploads
6. THE Django_Backend SHALL achieve minimum 80% code coverage
7. THE Django_Backend SHALL include tests for database migrations
8. THE Django_Backend SHALL include tests for Celery tasks
9. THE Django_Backend SHALL include tests for WebSocket connections
10. THE Django_Backend SHALL include tests for cache invalidation
11. THE Django_Backend SHALL use pytest or Django TestCase for testing
12. THE Django_Backend SHALL use factory_boy or fixtures for test data
13. THE Django_Backend SHALL include API compatibility tests comparing with Legacy_Backend
14. THE Django_Backend SHALL include performance tests for critical endpoints
15. THE Django_Backend SHALL include security tests for authentication and authorization
16. THE Django_Backend SHALL provide test documentation and running instructions


### Requirement 27: Deployment Configuration for Render.com

**User Story:** As a system administrator, I want deployment configuration for Render.com, so that I can deploy the Django system to production.

#### Acceptance Criteria

1. THE Django_Backend SHALL include a render.yaml configuration file
2. THE Django_Backend SHALL configure PostgreSQL database connection for Render_Platform
3. THE Django_Backend SHALL configure Redis instance for caching and Celery
4. THE Django_Backend SHALL configure static file serving for React_Frontend
5. THE Django_Backend SHALL configure environment variables for production
6. THE Django_Backend SHALL use gunicorn as the WSGI server
7. THE Django_Backend SHALL use daphne or uvicorn for ASGI (WebSocket) support
8. THE Django_Backend SHALL configure separate web service and Celery worker service
9. THE Django_Backend SHALL configure health check endpoints for Render monitoring
10. THE Django_Backend SHALL use DATABASE_URL environment variable for database connection
11. THE Django_Backend SHALL use REDIS_URL environment variable for Redis connection
12. THE Django_Backend SHALL configure ALLOWED_HOSTS for Render domain
13. THE Django_Backend SHALL configure CORS_ALLOWED_ORIGINS for React_Frontend
14. THE Django_Backend SHALL disable DEBUG mode in production
15. THE Django_Backend SHALL configure SECRET_KEY from environment variable
16. THE Django_Backend SHALL include build command for installing dependencies
17. THE Django_Backend SHALL include start command for running the server
18. THE Django_Backend SHALL configure automatic database migrations on deployment


### Requirement 28: Security and Authentication Hardening

**User Story:** As a security administrator, I want robust security measures, so that the system is protected against common vulnerabilities.

#### Acceptance Criteria

1. THE Django_Backend SHALL use Django's built-in CSRF protection for state-changing operations
2. THE Django_Backend SHALL use Django's built-in SQL injection protection via ORM
3. THE Django_Backend SHALL use Django's built-in XSS protection via template escaping
4. THE Django_Backend SHALL enforce HTTPS in production via SECURE_SSL_REDIRECT
5. THE Django_Backend SHALL set secure cookie flags (HttpOnly, Secure, SameSite)
6. THE Django_Backend SHALL implement rate limiting for authentication endpoints
7. THE Django_Backend SHALL implement rate limiting for file upload endpoints
8. THE Django_Backend SHALL validate and sanitize all user inputs
9. THE Django_Backend SHALL use parameterized queries for all database operations
10. THE Django_Backend SHALL hash passwords using bcrypt with appropriate work factor
11. THE Django_Backend SHALL implement JWT token expiration and refresh
12. THE Django_Backend SHALL log all authentication failures
13. THE Django_Backend SHALL implement account lockout after failed login attempts
14. THE Django_Backend SHALL validate file uploads for type and size
15. THE Django_Backend SHALL sanitize filenames to prevent path traversal attacks
16. THE Django_Backend SHALL use Django's built-in clickjacking protection
17. THE Django_Backend SHALL set appropriate Content-Security-Policy headers
18. THE Django_Backend SHALL implement role-based access control for all endpoints


### Requirement 29: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. THE Django_Backend SHALL use Python logging module for all logging
2. THE Django_Backend SHALL log all errors with stack traces
3. THE Django_Backend SHALL log all API requests with method, path, status code, response time
4. THE Django_Backend SHALL log all database queries in development mode
5. THE Django_Backend SHALL log all authentication attempts (success and failure)
6. THE Django_Backend SHALL log all file upload operations
7. THE Django_Backend SHALL use structured logging with JSON format
8. THE Django_Backend SHALL configure different log levels for development and production
9. THE Django_Backend SHALL rotate log files to prevent disk space issues
10. THE Django_Backend SHALL send critical errors to admin notifications
11. THE Django_Backend SHALL return user-friendly error messages in API responses
12. THE Django_Backend SHALL return detailed error messages in development mode
13. THE Django_Backend SHALL return generic error messages in production mode
14. THE Django_Backend SHALL handle database connection errors gracefully
15. THE Django_Backend SHALL handle Redis connection errors gracefully
16. THE Django_Backend SHALL provide error tracking integration (Sentry-compatible)
17. THE Django_Backend SHALL log all Celery task executions and failures


### Requirement 30: Documentation and Developer Experience

**User Story:** As a developer, I want comprehensive documentation, so that I can understand and maintain the Django system.

#### Acceptance Criteria

1. THE Django_Backend SHALL include a README.md with setup instructions
2. THE Django_Backend SHALL include API documentation using Django REST Framework's built-in docs
3. THE Django_Backend SHALL include database schema documentation
4. THE Django_Backend SHALL include deployment documentation for Render_Platform
5. THE Django_Backend SHALL include migration guide from Legacy_Backend
6. THE Django_Backend SHALL include troubleshooting guide for common issues
7. THE Django_Backend SHALL include code comments for complex logic
8. THE Django_Backend SHALL include docstrings for all functions and classes
9. THE Django_Backend SHALL include environment variable documentation
10. THE Django_Backend SHALL include testing documentation
11. THE Django_Backend SHALL include Celery task documentation
12. THE Django_Backend SHALL include WebSocket protocol documentation
13. THE Django_Backend SHALL include API endpoint comparison table with Legacy_Backend
14. THE Django_Backend SHALL include performance optimization guide
15. THE Django_Backend SHALL include security best practices documentation
16. THE Django_Backend SHALL provide example API requests using curl or httpie
17. THE Django_Backend SHALL include architecture diagrams for system components


### Requirement 31: Performance Optimization

**User Story:** As a system administrator, I want the Django system to perform as well as or better than the Node.js system, so that users experience fast response times.

#### Acceptance Criteria

1. THE Django_Backend SHALL respond to GET /api/cadets within 200ms for 100 cadets
2. THE Django_Backend SHALL respond to GET /api/grades within 200ms for 100 grade records
3. THE Django_Backend SHALL use database connection pooling with minimum 5 connections
4. THE Django_Backend SHALL use select_related() and prefetch_related() for related objects
5. THE Django_Backend SHALL use database indexes on frequently queried fields
6. THE Django_Backend SHALL use Redis caching for frequently accessed data
7. THE Django_Backend SHALL compress API responses using gzip
8. THE Django_Backend SHALL use pagination for list endpoints (default 50 items per page)
9. THE Django_Backend SHALL optimize database queries to avoid N+1 problems
10. THE Django_Backend SHALL use bulk_create() and bulk_update() for batch operations
11. THE Django_Backend SHALL use database transactions for multi-step operations
12. THE Django_Backend SHALL monitor slow queries and optimize them
13. THE Django_Backend SHALL use async views for I/O-bound operations where beneficial
14. THE Django_Backend SHALL configure gunicorn with appropriate worker count
15. THE Django_Backend SHALL use persistent database connections
16. THE Django_Backend SHALL implement query result caching for expensive operations


### Requirement 32: Mobile and Desktop App Compatibility

**User Story:** As a mobile/desktop app user, I want the apps to continue working with the Django backend, so that I can use the system on all platforms.

#### Acceptance Criteria

1. THE Django_Backend SHALL maintain API compatibility with Android app built using Capacitor
2. THE Django_Backend SHALL maintain API compatibility with Electron desktop app
3. THE Django_Backend SHALL support CORS for mobile app requests
4. THE Django_Backend SHALL support the same authentication mechanism used by mobile apps
5. THE Django_Backend SHALL return responses compatible with mobile app expectations
6. THE Django_Backend SHALL support file uploads from mobile devices
7. THE Django_Backend SHALL support push notifications to mobile devices
8. THE Django_Backend SHALL support offline sync when mobile apps reconnect
9. THE Django_Backend SHALL handle mobile-specific headers and user agents
10. THE Django_Backend SHALL support QR code scanning endpoints for mobile attendance
11. THE Django_Backend SHALL optimize image sizes for mobile bandwidth
12. THE Django_Backend SHALL support geolocation data from mobile devices
13. THE Django_Backend SHALL provide mobile-optimized error messages
14. WHEN mobile apps make requests, THE Django_Backend SHALL log device information
15. THE Django_Backend SHALL support the same WebSocket protocol for real-time updates


### Requirement 33: Rollback and Disaster Recovery

**User Story:** As a system administrator, I want rollback capabilities, so that I can revert to the Node.js system if critical issues occur.

#### Acceptance Criteria

1. THE Migration_Script SHALL create a complete backup of Legacy_Backend database before migration
2. THE Migration_Script SHALL create a complete backup of all Cloudinary file references
3. THE Migration_Script SHALL provide a rollback script to restore Legacy_Backend
4. THE Django_Backend SHALL support running in parallel with Legacy_Backend during transition
5. THE Django_Backend SHALL support read-only mode for testing without data modification
6. THE Django_Backend SHALL provide database dump functionality for backups
7. THE Django_Backend SHALL document the rollback procedure step-by-step
8. THE Django_Backend SHALL support gradual traffic migration (e.g., 10%, 50%, 100%)
9. THE Django_Backend SHALL provide health check endpoints for monitoring during migration
10. THE Django_Backend SHALL log all operations during migration for audit trail
11. THE Django_Backend SHALL support data synchronization between Legacy_Backend and Django_Backend
12. THE Django_Backend SHALL provide comparison tools to verify data consistency
13. WHEN critical errors occur, THE Django_Backend SHALL alert administrators immediately
14. THE Django_Backend SHALL document known issues and workarounds
15. THE Django_Backend SHALL provide emergency contact procedures for migration support


### Requirement 34: Frontend Integration and Compatibility Testing

**User Story:** As a frontend developer, I want to verify the React frontend works with Django, so that I can ensure a smooth user experience.

#### Acceptance Criteria

1. THE Django_Backend SHALL pass all existing frontend integration tests
2. THE Django_Backend SHALL support the same API base URL configuration as Legacy_Backend
3. THE Django_Backend SHALL return CORS headers allowing React_Frontend origin
4. THE Django_Backend SHALL support the same authentication token format in headers
5. THE Django_Backend SHALL return the same JSON structure for user profile data
6. THE Django_Backend SHALL return the same JSON structure for cadet lists
7. THE Django_Backend SHALL return the same JSON structure for grade data
8. THE Django_Backend SHALL return the same JSON structure for attendance records
9. THE Django_Backend SHALL return the same JSON structure for notifications
10. THE Django_Backend SHALL support the same query parameters for filtering and pagination
11. THE Django_Backend SHALL return the same HTTP status codes for success and error cases
12. THE Django_Backend SHALL support the same file upload multipart format
13. THE Django_Backend SHALL provide a compatibility test suite comparing responses with Legacy_Backend
14. WHEN API responses differ, THE Django_Backend SHALL document the differences
15. THE Django_Backend SHALL provide a frontend adapter library if breaking changes are unavoidable
16. THE Django_Backend SHALL support the same WebSocket message format for real-time updates


## Migration Success Criteria

The migration will be considered successful when:

1. All 19 database tables are replicated with identical schema
2. All existing data is migrated without loss or corruption
3. All 100+ API endpoints are functional and return compatible responses
4. React frontend works without code changes (or with minimal adapter layer)
5. Mobile apps (Android/Capacitor) continue working without updates
6. Desktop app (Electron) continues working without updates
7. All authentication and authorization works with existing credentials
8. All file uploads and Cloudinary integrations work correctly
9. Real-time updates via WebSocket/Channels work as expected
10. Background tasks via Celery execute successfully
11. Caching via Redis improves performance
12. All tests pass with minimum 80% code coverage
13. System deploys successfully to Render.com
14. Performance matches or exceeds Node.js version
15. Zero data loss verified through data validation
16. Rollback procedure tested and documented
17. All documentation is complete and accurate

## Migration Phases

The migration will proceed in these phases:

1. **Phase 1: Foundation** - Django project setup, database models, basic configuration
2. **Phase 2: Core API** - Authentication, user management, cadet management, grades
3. **Phase 3: Extended Features** - Attendance, activities, staff management, messaging
4. **Phase 4: Advanced Features** - File uploads, real-time updates, background tasks, caching
5. **Phase 5: Integration** - ROTCMIS import/export, PDF generation, OCR processing
6. **Phase 6: Testing** - Unit tests, integration tests, API compatibility tests
7. **Phase 7: Data Migration** - Export from Node.js, import to Django, validation
8. **Phase 8: Deployment** - Render.com configuration, production deployment
9. **Phase 9: Validation** - Frontend testing, mobile testing, performance testing
10. **Phase 10: Cutover** - Traffic migration, monitoring, rollback readiness

## Notes

- This migration prioritizes 100% feature parity and data preservation
- The Django system must be a drop-in replacement for the Node.js system
- Frontend changes should be minimized or eliminated through API compatibility
- All existing user credentials, files, and data must be preserved
- The migration must support zero-downtime cutover if possible
- Rollback capability is essential for risk mitigation
