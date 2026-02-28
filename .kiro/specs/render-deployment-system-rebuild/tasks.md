# Implementation Plan: Render Deployment System Rebuild

## Overview

This plan implements the migration from Node.js/Express backend to Django/Python backend deployed on Render's cloud platform. The implementation includes deploying four Django services (web, channels, celery worker, celery beat), migrating data with integrity verification, updating frontend integration, and establishing production-ready infrastructure.

## Tasks

- [x] 1. Set up Django project structure and core configuration
  - Create Django project with production settings module
  - Configure environment variable loading and validation
  - Set up logging configuration with Sentry integration
  - Configure security settings (HTTPS, HSTS, security headers)
  - _Requirements: 1.5, 1.6, 1.7, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 25.1, 25.2, 25.3, 25.4, 25.5_

- [ ] 2. Configure database and caching infrastructure
  - [x] 2.1 Set up PostgreSQL database connection with NeonDB
    - Configure DATABASE_URL parsing with dj-database-url
    - Set up connection pooling parameters
    - Configure SSL mode for secure connections
    - _Requirements: 1.5, 24.1, 24.2, 24.3, 24.4_

  - [x] 2.2 Configure Redis for caching and message broker
    - Set up django-redis cache backend
    - Configure cache timeout and key prefix settings
    - Set up Redis connection pooling
    - _Requirements: 1.6, 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 2.3 Implement health check endpoint
    - Create /api/health endpoint with database, Redis, and Celery status checks
    - Return JSON response with service health information
    - _Requirements: 1.3, 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 3. Implement authentication and authorization system
  - [ ] 3.1 Configure JWT authentication with djangorestframework-simplejwt
    - Set up JWT token generation and validation
    - Configure token expiration times (15 min access, 7 days refresh)
    - Implement token rotation mechanism
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 3.2 Set up password hashing with BCrypt
    - Configure BCryptSHA256PasswordHasher as primary hasher
    - Set up password validators for complexity requirements
    - _Requirements: 9.5, 27.2, 27.3, 27.4_

  - [ ] 3.3 Implement rate limiting for authentication endpoints
    - Add django-ratelimit to login endpoint (5 attempts per 15 minutes)
    - Configure IP-based rate limiting
    - _Requirements: 9.6_

  - [ ]* 3.4 Write unit tests for authentication
    - Test JWT token generation and validation
    - Test password hashing and verification
    - Test rate limiting behavior
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

- [ ] 4. Configure Gunicorn WSGI server for Django Web Service
  - [x] 4.1 Create gunicorn.conf.py with Render port binding
    - Bind to 0.0.0.0:$PORT (critical for Render)
    - Configure 4 workers with sync worker class
    - Set timeout, keepalive, and max_requests parameters
    - Configure logging to stdout/stderr
    - _Requirements: 1.1, 1.2_

  - [ ]* 4.2 Write property test for port binding
    - **Property 1: Port Binding Correctness**
    - **Validates: Requirements 1.1**
    - Test that service binds to PORT environment variable correctly
    - _Requirements: 1.1_

- [ ] 5. Configure Daphne ASGI server for Django Channels Service
  - [x] 5.1 Create daphne configuration for WebSocket support
    - Bind to 0.0.0.0:$PORT (critical for Render)
    - Configure WebSocket timeout (24 hours)
    - Set up ping/pong for connection health
    - Configure Redis channel layer
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [ ] 5.2 Implement WebSocket authentication middleware
    - Extract JWT token from query parameter
    - Validate token and attach user to scope
    - Reject unauthenticated connections
    - _Requirements: 2.4_

  - [ ] 5.3 Create WebSocket consumers for notifications and chat
    - Implement /ws/notifications/ consumer
    - Implement /ws/chat/{room_id}/ consumer
    - Implement /ws/updates/ consumer
    - Handle message broadcasting to groups
    - _Requirements: 2.3, 2.7, 12.1, 12.2, 12.3, 12.4, 12.5, 26.1, 26.2, 26.3, 26.4_

  - [ ]* 5.4 Write integration tests for WebSocket connections
    - Test WebSocket connection establishment
    - Test JWT authentication
    - Test message broadcasting
    - Test connection persistence
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 12.1, 12.2, 12.3_

- [ ] 6. Set up Celery for background task processing
  - [ ] 6.1 Configure Celery with Redis broker
    - Create config/celery.py with Redis broker URL
    - Configure task serialization (JSON)
    - Set task time limits (30 minutes)
    - Configure worker settings (2 concurrency, prefetch multiplier)
    - _Requirements: 3.1, 3.2, 3.7_

  - [ ] 6.2 Implement background tasks
    - Create email notification task with retry logic
    - Create report generation task (PDF)
    - Create file processing tasks (OCR, compression, thumbnails)
    - Create data export tasks (CSV, Excel)
    - Implement task result storage in Redis
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 6.3 Configure Celery Beat for scheduled tasks
    - Set up CELERY_BEAT_SCHEDULE with cron expressions
    - Add cleanup-old-sessions task (daily 2 AM UTC)
    - Add generate-daily-reports task (daily 6 AM UTC)
    - Add sync-attendance task (every 15 minutes)
    - Add cleanup-expired-tokens task (daily 3 AM UTC)
    - Add backup-database task (weekly Sunday 4 AM UTC)
    - _Requirements: 4.2, 4.3, 4.4, 21.1, 21.2, 21.3, 21.4, 21.5_

  - [ ]* 6.4 Write unit tests for Celery tasks
    - Test task execution and retry logic
    - Test task result storage
    - Test scheduled task configuration
    - _Requirements: 3.3, 3.4, 3.5, 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 7. Checkpoint - Verify Django services configuration
  - Ensure all configuration files are correct
  - Verify environment variables are documented
  - Ask the user if questions arise

- [ ] 8. Implement Django REST API endpoints
  - [ ] 8.1 Create authentication endpoints
    - POST /api/v1/auth/login - User login with JWT token generation
    - POST /api/v1/auth/logout - User logout
    - POST /api/v1/auth/refresh - Token refresh
    - POST /api/v1/auth/verify - Token verification
    - _Requirements: 1.4, 9.1, 9.2, 9.3_

  - [ ] 8.2 Create cadet management endpoints
    - GET /api/v1/cadets/ - List cadets with pagination
    - POST /api/v1/cadets/ - Create cadet
    - GET /api/v1/cadets/{id}/ - Get cadet details
    - PUT /api/v1/cadets/{id}/ - Update cadet
    - DELETE /api/v1/cadets/{id}/ - Delete cadet
    - _Requirements: 1.4, 22.1, 22.2, 22.3, 22.4_

  - [ ] 8.3 Create staff, activities, attendance, grading, files, reports, and messaging endpoints
    - Implement CRUD operations for each resource
    - Add pagination support (default 20, max 100)
    - Implement permission checks for each endpoint
    - Add input validation and sanitization
    - _Requirements: 1.4, 9.4, 20.1, 20.2, 20.3, 20.4, 20.5, 22.1, 22.2, 22.3, 22.4, 22.5_

  - [ ]* 8.4 Write integration tests for API endpoints
    - Test authentication flow
    - Test CRUD operations
    - Test pagination
    - Test permission enforcement
    - Test input validation
    - _Requirements: 1.4, 9.1, 9.2, 9.3, 9.4, 20.1, 20.2, 20.3, 22.1, 22.2, 22.3_

- [ ] 9. Implement file upload and storage with Cloudinary
  - [ ] 9.1 Configure django-storages with Cloudinary backend
    - Set up Cloudinary credentials from environment variables
    - Configure media file storage
    - Set up file type and size validation
    - _Requirements: 10.1_

  - [ ] 9.2 Create file upload endpoint
    - POST /api/v1/files/upload - Handle multipart file upload
    - Validate file type and size
    - Upload to Cloudinary
    - Save file metadata to database
    - Queue background processing task
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 9.3 Write unit tests for file upload
    - Test file validation
    - Test Cloudinary upload
    - Test error handling
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 10. Implement database query optimization
  - [ ] 10.1 Add select_related and prefetch_related to querysets
    - Optimize foreign key queries with select_related()
    - Optimize many-to-many queries with prefetch_related()
    - Use only() and defer() for field selection
    - _Requirements: 13.1, 13.2_

  - [ ] 10.2 Implement API response caching
    - Add cache decorators to GET endpoints
    - Implement cache invalidation on POST/PUT/PATCH/DELETE
    - Set appropriate TTL for different data types
    - _Requirements: 13.3, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 10.3 Add database indexes to models
    - Add indexes to frequently queried fields
    - Create composite indexes for multi-field queries
    - _Requirements: 13.5_

  - [ ]* 10.4 Write performance tests
    - **Property 6: Response Time Performance**
    - **Validates: Requirements 17.3**
    - Test that 95th percentile response time < 500ms for read operations
    - _Requirements: 17.2, 17.3_

- [ ] 11. Configure CORS and security headers
  - [ ] 11.1 Set up django-cors-headers
    - Configure CORS_ALLOWED_ORIGINS from environment variable
    - Set CORS_ALLOW_CREDENTIALS to true
    - Configure allowed methods and headers
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

  - [ ] 11.2 Configure security middleware and headers
    - Enable SECURE_SSL_REDIRECT
    - Set SECURE_HSTS_SECONDS to 31536000
    - Configure X-Content-Type-Options, X-Frame-Options
    - Set secure cookie flags
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [ ]* 11.3 Write security tests
    - Test HTTPS redirect
    - Test security headers presence
    - Test CORS configuration
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 30.1, 30.2, 30.3_

- [ ] 12. Configure static file serving with WhiteNoise
  - Set up WhiteNoise middleware
  - Configure CompressedManifestStaticFilesStorage
  - Set cache headers with max-age 31536000
  - Enable compression
  - _Requirements: 23.1, 23.2, 23.3, 23.4_

- [ ] 13. Checkpoint - Verify Django backend implementation
  - Run all tests locally
  - Verify all endpoints are functional
  - Check database queries are optimized
  - Ask the user if questions arise

- [ ] 14. Create data migration scripts
  - [ ] 14.1 Implement Node.js data export script
    - Create scripts/export_nodejs_data.py
    - Connect to Node.js database using NODEJS_DATABASE_URL
    - Export all tables to JSON files in dependency order
    - Convert datetime values to ISO 8601 format
    - Create manifest file with export metadata
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 14.2 Implement Django data import script
    - Create scripts/import_django_data.py
    - Read JSON files from export directory
    - Map Node.js field names to Django field names
    - Transform data types (datetime to UTC, boolean 1/0 to true/false)
    - Prefix password hashes with "bcrypt_sha256$"
    - Preserve foreign key relationships
    - Use update_or_create for idempotent imports
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 27.1_

  - [ ] 14.3 Implement data integrity verification script
    - Create scripts/verify_migration.py
    - Compare record counts between Node.js and Django databases
    - Verify foreign key integrity (no orphaned records)
    - Log discrepancies with table names and counts
    - Return success status with integrity confirmation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 14.4 Write property test for data migration
    - **Property 2: Data Migration Integrity**
    - **Validates: Requirements 5.2, 5.3, 6.2, 6.3, 6.4, 6.5, 7.1**
    - Test that all records are migrated with correct transformations
    - **Property 3: Foreign Key Integrity**
    - **Validates: Requirements 6.6, 7.3, 7.4**
    - Test that all foreign key relationships are preserved
    - _Requirements: 5.2, 5.3, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.3, 7.4_

- [ ] 15. Create database backup and rollback scripts
  - [ ] 15.1 Implement database backup script
    - Create scripts/backup_database.py
    - Create backup of Node.js database before migration
    - Verify backup file is valid and complete
    - Store backup metadata (timestamp, file path)
    - _Requirements: 29.1, 29.2, 29.3_

  - [ ] 15.2 Implement rollback script
    - Create scripts/rollback_to_nodejs.py
    - Stop all Django services
    - Restore Node.js database from backup
    - Verify database restore integrity
    - _Requirements: 18.1, 18.2, 29.4, 29.5_

  - [ ]* 15.3 Write property test for rollback
    - **Property 10: Rollback Completeness**
    - **Validates: Requirements 18.6, 18.7**
    - Test that rollback completes within 15 minutes with no data loss
    - _Requirements: 18.6, 18.7_

- [ ] 16. Update frontend API client configuration
  - [x] 16.1 Update API client to use Django backend URLs
    - Modify client/src/utils/api.js to use VITE_API_URL and VITE_WS_URL
    - Ensure JWT token is included in Authorization header
    - Implement error handling for 401, 403, 5xx responses
    - Handle network errors with NETWORK_ERROR code
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 16.2 Create production environment configuration
    - Create client/.env.production with Django service URLs
    - Set VITE_API_URL to https://rotc-django-web.onrender.com
    - Set VITE_WS_URL to wss://rotc-django-channels.onrender.com
    - _Requirements: 8.1, 8.2_

  - [ ]* 16.3 Write integration tests for frontend API client
    - Test API request with JWT token
    - Test error handling for different status codes
    - Test network error handling
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 17. Create Render deployment configuration
  - [x] 17.1 Create render.yaml blueprint file
    - Define rotc-django-web service (Web Service, Python 3.11)
    - Define rotc-django-channels service (Web Service, Python 3.11)
    - Define rotc-celery-worker service (Worker Service, Python 3.11)
    - Define rotc-celery-beat service (Worker Service, Python 3.11)
    - Configure environment variables for all services
    - Set health check path to /api/health for web service
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2_

  - [x] 17.2 Create start commands for each service
    - Web: gunicorn -c rotc_backend/gunicorn.conf.py config.wsgi:application
    - Channels: daphne -b 0.0.0.0 -p $PORT config.asgi:application
    - Worker: celery -A config worker --loglevel=info --concurrency=2
    - Beat: celery -A config beat --loglevel=info
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2_

  - [x] 17.3 Document all required environment variables
    - Create .env.example with all required variables
    - Document DATABASE_URL, REDIS_URL, SECRET_KEY, ALLOWED_HOSTS
    - Document Cloudinary credentials
    - Document CORS_ALLOWED_ORIGINS
    - Document Sentry DSN
    - _Requirements: 1.5, 1.6, 1.7, 25.3, 25.4, 25.5_

- [ ] 18. Checkpoint - Verify deployment configuration
  - Review render.yaml for correctness
  - Verify all environment variables are documented
  - Ensure port binding is correct for all services
  - Ask the user if questions arise

- [ ] 19. Create deployment and migration workflow documentation
  - [x] 19.1 Document pre-deployment checklist
    - Verify all environment variables are set in Render
    - Verify NeonDB and Redis services are provisioned
    - Verify Cloudinary account is configured
    - Verify Sentry project is created
    - _Requirements: 25.3, 25.4_

  - [x] 19.2 Document migration execution steps
    - Step 1: Create database backup
    - Step 2: Export Node.js data
    - Step 3: Validate export
    - Step 4: Deploy Django services to Render
    - Step 5: Import data to Django database
    - Step 6: Verify data integrity
    - Step 7: Update frontend configuration
    - Step 8: Run integration tests
    - Step 9: Monitor production for 24 hours
    - Step 10: Remove Node.js backend (if successful)
    - _Requirements: 29.1, 29.2, 5.1, 5.2, 5.3, 6.1, 7.1, 8.1, 28.1, 28.2, 28.3, 28.4, 28.5_

  - [x] 19.3 Document rollback procedure
    - When to trigger rollback (error rate > 5%, response time > 1s)
    - Step 1: Stop Django services
    - Step 2: Restore Node.js database from backup
    - Step 3: Redeploy Node.js service
    - Step 4: Update frontend configuration
    - Step 5: Verify Node.js service health
    - Step 6: Run smoke tests
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 19.4 Document monitoring and alerting setup
    - Configure Sentry error tracking
    - Set up performance monitoring
    - Configure alert thresholds (error rate > 5%)
    - Document metrics to monitor (response time, error rate, cache hit rate)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 20. Create integration test suite for deployment verification
  - [ ] 20.1 Write end-to-end integration tests
    - Test user registration → login → access protected endpoint
    - Test file upload → background processing → notification
    - Test WebSocket connection → receive real-time update
    - Test API request → authentication → authorization → response
    - _Requirements: 28.3_

  - [ ] 20.2 Write deployment verification script
    - Verify all service statuses are "live"
    - Check health endpoints for all services
    - Verify integration test pass rate > 95%
    - _Requirements: 28.1, 28.2, 28.3_

  - [ ]* 20.3 Write property tests for system-wide properties
    - **Property 4: Authentication Token Validity**
    - **Validates: Requirements 8.3, 9.1, 9.2, 9.3**
    - Test that all authenticated requests have valid JWT tokens
    - **Property 5: Service Health Check**
    - **Validates: Requirements 1.3, 1.5, 1.6, 15.1, 15.2, 15.3, 15.4, 15.5**
    - Test that all live services pass health checks
    - **Property 7: Error Rate Threshold**
    - **Validates: Requirements 16.5, 28.4**
    - Test that error rate monitoring triggers rollback when threshold exceeded
    - **Property 8: WebSocket Connection Persistence**
    - Test that authenticated WebSocket connections remain open for up to 24 hours
    - **Property 9: Background Task Execution**
    - Test that all queued tasks are processed within maximum wait time
    - _Requirements: 8.3, 9.1, 9.2, 9.3, 1.3, 1.5, 1.6, 15.1, 15.2, 15.3, 16.5, 28.4_

- [ ] 21. Final checkpoint - Pre-deployment verification
  - Run all tests locally and verify pass rate > 95%
  - Verify all configuration files are correct
  - Verify all environment variables are documented
  - Review deployment and rollback procedures
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit and integration tests validate specific examples and edge cases
- Critical: All services MUST bind to 0.0.0.0:$PORT for Render compatibility
- Migration must be executed in order with verification at each step
- Rollback capability must be tested before production deployment
- Monitor production for 24 hours before removing Node.js backend
