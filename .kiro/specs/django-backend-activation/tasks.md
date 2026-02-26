# Implementation Plan: Django Backend Activation

## Overview

This plan activates the Django backend as the production system for the ROTC Grading System. The Django backend is already feature-complete with all models, API endpoints, authentication, file uploads, caching, background tasks, WebSocket support, and comprehensive tests implemented. This implementation focuses on deployment configuration, port binding fixes, environment setup, frontend integration, data migration, and legacy code removal.

## Priority Focus

The critical priority is fixing the port binding issue that's causing deployment failures. Tasks are ordered to address this first, followed by configuration updates, testing, data migration, and cleanup.

## Tasks

- [ ] 1. Fix port binding issue (CRITICAL)
  - [ ] 1.1 Update Gunicorn configuration to bind to 0.0.0.0:$PORT
    - Modify `rotc_backend/gunicorn.conf.py` to read PORT from environment variable
    - Set bind to `f"0.0.0.0:{port}"` where port defaults to 8000 for local dev
    - Configure worker settings (4 workers, 120s timeout, preload_app=True)
    - _Requirements: 1.6_
  
  - [ ] 1.2 Update Daphne configuration to bind to 0.0.0.0:$PORT
    - Modify `rotc_backend/daphne.conf.py` or update render.yaml start command
    - Use command: `daphne -b 0.0.0.0 -p $PORT config.asgi:application`
    - Configure WebSocket timeout settings
    - _Requirements: 1.7_
  
  - [ ]* 1.3 Write property test for port binding
    - **Property: Port Binding Correctness**
    - **Validates: Requirements 1.6, 1.7**
    - Test that Gunicorn and Daphne bind to the PORT environment variable
    - Verify binding to 0.0.0.0 (all interfaces)

- [ ] 2. Update deployment configuration
  - [ ] 2.1 Replace render.yaml with Django services configuration
    - Remove Node.js web service and cron job keepalive service
    - Add rotc-django-web service (WSGI with Gunicorn)
    - Add rotc-django-channels service (ASGI with Daphne)
    - Add rotc-celery-worker service
    - Add rotc-celery-beat service
    - Set Python version to 3.11.0 for all services
    - Configure build commands (pip install, collectstatic, migrate)
    - Configure start commands for each service
    - Set health check path to `/api/health` for web service
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  
  - [ ] 2.2 Update root package.json scripts
    - Update build script to only build frontend: `cd client && npm install && npm run build`
    - Update start script to serve frontend static files
    - Update dev script to run Django backend: `cd rotc_backend && python manage.py runserver`
    - Add backend, migrate, and test scripts for Django
    - _Requirements: 1.9, 1.10_
  
  - [ ]* 2.3 Write unit tests for deployment configuration
    - Test render.yaml is valid YAML with 4 services
    - Test frontend build succeeds without Node backend
    - Verify service names and configuration structure

- [ ] 3. Configure environment variables on Render
  - [ ] 3.1 Set core Django environment variables
    - Set DJANGO_SETTINGS_MODULE=config.settings.production
    - Generate and set SECRET_KEY using Django's get_random_secret_key()
    - Set DEBUG=false
    - Set PYTHON_VERSION=3.11.0
    - _Requirements: 2.1, 2.2, 2.9_
  
  - [ ] 3.2 Set host and CORS configuration
    - Set RENDER_EXTERNAL_HOSTNAME to the Render service hostname
    - Set ALLOWED_HOSTS (comma-separated list of allowed domains)
    - Set CORS_ALLOWED_ORIGINS (comma-separated list of frontend domains)
    - _Requirements: 2.3, 2.4_
  
  - [ ] 3.3 Set database and Redis URLs
    - Set DATABASE_URL pointing to PostgreSQL database
    - Set REDIS_URL pointing to Redis instance
    - Set CELERY_BROKER_URL and CELERY_RESULT_BACKEND to Redis URL
    - _Requirements: 2.5, 2.6, 2.7_
  
  - [ ] 3.4 Set Cloudinary credentials
    - Set CLOUDINARY_CLOUD_NAME
    - Set CLOUDINARY_API_KEY
    - Set CLOUDINARY_API_SECRET
    - _Requirements: 2.8_
  
  - [ ]* 3.5 Write unit tests for environment variable validation
    - Test that missing required env vars raise ImproperlyConfigured
    - Test that Django logs descriptive error messages for invalid env vars
    - _Requirements: 2.10_

- [ ] 4. Checkpoint - Deploy and verify Django services
  - Deploy all four Django services to Render
  - Verify all services reach "Live" status in Render dashboard
  - Check health endpoint returns 200 OK with database, Redis, and Celery status
  - Verify logs show successful startup without port binding errors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update frontend API configuration
  - [ ] 5.1 Update frontend environment variables
    - Update .env.production with VITE_API_URL pointing to Django web service
    - Update VITE_WS_URL pointing to Django channels service
    - _Requirements: 3.1_
  
  - [ ] 5.2 Update API client for Django backend
    - Modify `client/src/utils/api.js` to use `/api/v1/` prefix
    - Update request interceptor to include JWT token in Authorization header
    - Update response interceptor to handle Django error format (error, message, code, details)
    - Handle 401 responses by redirecting to login
    - Handle network errors with user-friendly messages
    - _Requirements: 3.2, 3.3, 3.7, 3.9, 3.10_
  
  - [ ] 5.3 Update WebSocket client for Django Channels
    - Modify `client/src/utils/websocket.js` to use Django Channels URL
    - Update connection logic to include JWT token in query parameter
    - Implement reconnection logic with exponential backoff
    - _Requirements: 3.8_
  
  - [ ]* 5.4 Write property tests for frontend API integration
    - **Property 9: JWT Token Inclusion** - Validates: Requirements 3.3
    - **Property 10: Datetime Parsing** - Validates: Requirements 3.4
    - **Property 11: Paginated Response Handling** - Validates: Requirements 3.6
  
  - [ ]* 5.5 Write unit tests for frontend error handling
    - Test 401 response redirects to login
    - Test network error shows user-friendly message
    - Test API uses correct `/api/v1/` prefix

- [ ] 6. Test deployment in staging environment
  - [ ] 6.1 Deploy to staging and run integration tests
    - Deploy all services to staging environment
    - Run all Django integration tests
    - Test authentication flow with JWT tokens
    - Test CRUD operations for all 19 models
    - Test file upload to Cloudinary
    - Test WebSocket connections
    - Test Celery task execution
    - _Requirements: 9.1, 9.2_
  
  - [ ] 6.2 Verify frontend features in staging
    - Test user login and authentication
    - Test cadet management features
    - Test grading operations
    - Test file uploads and downloads
    - Test real-time notifications via WebSocket
    - Test all critical user flows
    - _Requirements: 9.3_
  
  - [ ]* 6.3 Write property tests for backend functionality
    - **Property 13: User Authentication** - Validates: Requirements 6.2
    - **Property 14: CRUD Operations** - Validates: Requirements 6.3
    - **Property 15: File Upload Success** - Validates: Requirements 6.4
    - **Property 16: Background Task Execution** - Validates: Requirements 6.5
    - **Property 17: Redis Cache Round-Trip** - Validates: Requirements 6.7
    - **Property 12: Error Response Standardization** - Validates: Requirements 3.7, 6.9
  
  - [ ]* 6.4 Write unit tests for backend health and functionality
    - Test health check endpoint returns correct format
    - Test WebSocket connection establishes successfully
    - Test Celery task execution completes

- [ ] 7. Checkpoint - Staging validation complete
  - Ensure all integration tests pass in staging
  - Verify all frontend features work correctly
  - Confirm performance metrics are acceptable (95th percentile < 500ms)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Prepare data migration scripts
  - [ ] 8.1 Create export script for Node.js database
    - Write `rotc_backend/scripts/export_nodejs_data.py`
    - Connect to Node.js PostgreSQL database using NODEJS_DATABASE_URL
    - Export all 19 tables to JSON files in dependency order
    - Handle datetime serialization to ISO 8601 format
    - Generate export manifest with record counts
    - _Requirements: 4.1_
  
  - [ ] 8.2 Create import script for Django database
    - Write `rotc_backend/scripts/import_django_data.py`
    - Read JSON export files
    - Import users with bcrypt password hash preservation (prefix with bcrypt_sha256$)
    - Import all other models in dependency order
    - Handle field mapping between Node.js and Django schemas
    - Preserve timestamps in UTC timezone
    - _Requirements: 4.3, 4.5, 4.6_
  
  - [ ] 8.3 Create verification script
    - Write `rotc_backend/scripts/verify_migration.py`
    - Compare record counts between source and destination databases
    - Verify foreign key relationships (no orphaned records)
    - Verify many-to-many relationships are preserved
    - Verify file URLs are accessible
    - Generate verification report with discrepancies
    - _Requirements: 4.8, 10.1, 10.2, 10.3, 10.4, 10.7_
  
  - [ ]* 8.4 Write property tests for data migration
    - **Property 1: Relationship Preservation** - Validates: Requirements 4.4, 10.2, 10.7
    - **Property 2: Timestamp Preservation** - Validates: Requirements 4.5, 10.5
    - **Property 3: Password Authentication Preservation** - Validates: Requirements 4.6, 10.3
    - **Property 4: File URL Accessibility** - Validates: Requirements 4.7, 10.4
    - **Property 5: Record Count Preservation** - Validates: Requirements 10.1
    - **Property 6: Data Type Correctness** - Validates: Requirements 3.5, 10.6
    - **Property 7: Unique Constraint Enforcement** - Validates: Requirements 10.8
    - **Property 8: Round-Trip Serialization** - Validates: Requirements 10.10
  
  - [ ]* 8.5 Write unit tests for migration scripts
    - Test export script creates JSON files and manifest
    - Test import handles missing foreign keys gracefully
    - Test validation detects orphaned records

- [ ] 9. Execute data migration
  - [ ] 9.1 Create database backup
    - Create backup of Node.js PostgreSQL database
    - Create backup of Django PostgreSQL database (if any existing data)
    - Document backup locations and restoration procedures
    - _Requirements: 9.5_
  
  - [ ] 9.2 Run export script
    - Execute `python rotc_backend/scripts/export_nodejs_data.py`
    - Verify all tables exported successfully
    - Review export manifest for completeness
    - _Requirements: 4.1, 4.2_
  
  - [ ] 9.3 Run import script
    - Execute `python rotc_backend/scripts/import_django_data.py`
    - Monitor for foreign key violations or errors
    - Verify import completes without data loss
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ] 9.4 Run verification script
    - Execute `python rotc_backend/scripts/verify_migration.py`
    - Review verification report for discrepancies
    - Verify 100% data integrity (record counts match, no orphaned records)
    - Test user authentication with original passwords
    - Verify file URLs are accessible
    - _Requirements: 4.8, 4.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [ ] 10. Checkpoint - Data migration validated
  - Confirm all record counts match between databases
  - Verify all relationships are intact
  - Test user logins work with migrated passwords
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Deploy to production
  - [ ] 11.1 Deploy Django services to production
    - Deploy all four Django services (web, channels, celery worker, celery beat)
    - Verify all services reach "Live" status
    - Check health endpoint returns healthy status
    - Monitor logs for errors
    - _Requirements: 9.4, 9.6, 9.7, 9.8_
  
  - [ ] 11.2 Update frontend to use production Django backend
    - Update frontend environment variables to point to production Django URLs
    - Deploy updated frontend
    - Verify frontend connects to Django backend successfully
    - _Requirements: 9.4_
  
  - [ ] 11.3 Monitor production metrics
    - Monitor error rates (should be < 5%)
    - Monitor response times (95th percentile should be < 500ms)
    - Monitor service health for 24 hours
    - Set up alerts for error rate > 5% or response time > 1s
    - _Requirements: 9.9, 9.10_

- [ ] 12. Checkpoint - Production deployment stable
  - Verify error rates are acceptable (< 5%)
  - Verify response times are acceptable (< 500ms p95)
  - Confirm all critical features are functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Document rollback procedure
  - [ ] 13.1 Create rollback documentation
    - Document steps to revert Render services to Node.js deployment
    - Document steps to restore frontend API configuration
    - Document steps to restore Node.js database from backup
    - Document rollback decision criteria (error rates, response times)
    - Include estimated rollback time (target: < 15 minutes)
    - Document contact information for escalation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.10_
  
  - [ ] 13.2 Test rollback procedure in staging
    - Execute rollback in staging environment
    - Verify Node.js backend restores successfully
    - Verify frontend reconnects to Node.js backend
    - Time the rollback process
    - _Requirements: 5.9_
  
  - [ ] 13.3 Document state preservation during rollback
    - Document how to preserve Django database state for analysis
    - Document how to export logs and metrics
    - _Requirements: 5.7, 5.8_

- [ ] 14. Remove legacy Node.js backend
  - [ ] 14.1 Archive Node.js backend code
    - Create Git branch `archive/nodejs-backend` with current Node.js code
    - Push archive branch to remote repository
    - Document archive location in migration completion document
    - _Requirements: 7.1_
  
  - [ ] 14.2 Delete Node.js backend directory
    - Delete `server/` directory containing Node.js backend code
    - Remove Node.js backend dependencies from root package.json
    - Remove Node.js backend scripts from root package.json
    - Preserve migration scripts in `rotc_backend/scripts/` directory
    - _Requirements: 7.2, 7.3, 7.4, 7.7, 7.8, 7.9_
  
  - [ ] 14.3 Update documentation references
    - Update root README.md to document Django backend as active backend
    - Remove or update documentation files that reference Node.js backend
    - Create migration completion document summarizing what was removed
    - _Requirements: 7.5, 7.6, 7.10_

- [ ] 15. Update project documentation
  - [ ] 15.1 Update README.md with Django backend information
    - Document Django backend architecture (4 services)
    - Update setup instructions for Django installation
    - Document environment variable requirements
    - Document API endpoint structure with `/api/v1/` prefix
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 15.2 Document authentication and development workflows
    - Document JWT authentication flow
    - Document how to run Django migrations and management commands
    - Document how to run Celery workers and beat scheduler locally
    - Document how to run Django tests and property-based tests
    - _Requirements: 8.5, 8.6, 8.7, 8.8_
  
  - [ ] 15.3 Document deployment and troubleshooting
    - Document deployment process to Render.com using Django render.yaml
    - Include troubleshooting guides for common Django backend issues
    - Document port binding configuration
    - Document environment variable configuration
    - _Requirements: 8.9, 8.10_

- [ ] 16. Final checkpoint - Migration complete
  - Verify all Django services are running in production
  - Verify all frontend features work correctly
  - Verify data integrity is maintained
  - Verify Node.js backend is archived and removed
  - Verify documentation is updated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster deployment
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at critical stages
- Property tests validate universal correctness properties using hypothesis library
- Unit tests validate specific examples and edge cases
- The critical priority is Task 1 (port binding fix) which must be completed first
- Data migration (Tasks 8-10) should only be executed after staging validation is complete
- Rollback procedure (Task 13) should be documented and tested before production deployment
- Node.js backend removal (Task 14) should only be done after production is stable for 24+ hours
