# Requirements Document

## Introduction

This document specifies the requirements for migrating the ROTC Grading System from the Node.js/Express backend to the Django/Python backend as the active production backend. The Django backend is already substantially complete with all models, API endpoints, authentication, file uploads, caching, background tasks, WebSocket support, and comprehensive tests implemented. This migration involves updating deployment configurations, frontend integration, data migration, and removing the legacy Node.js backend.

## Glossary

- **Django_Backend**: The Python-based backend implementation located in the `rotc_backend/` directory, built with Django REST Framework
- **Node_Backend**: The legacy JavaScript-based backend implementation located in the `server/` directory, built with Express.js
- **Frontend**: The React-based client application located in the `client/` directory
- **Render_Service**: The cloud hosting platform (Render.com) where the application is deployed
- **Database_Migration**: The process of transferring data from the Node.js PostgreSQL database to the Django PostgreSQL database
- **API_Endpoint**: HTTP endpoints that the Frontend uses to communicate with the backend
- **Deployment_Configuration**: Files that control how services are built and deployed (render.yaml, package.json)
- **Environment_Variable**: Configuration values stored outside the codebase (API URLs, database credentials, etc.)
- **Health_Check**: An API endpoint that verifies the backend service is running correctly
- **Rollback_Plan**: A documented procedure to revert to the Node_Backend if issues occur
- **WebSocket_Service**: Real-time bidirectional communication service using Django Channels
- **Celery_Worker**: Background task processing service for asynchronous operations
- **Redis_Cache**: In-memory data store used for caching and message brokering

## Requirements

### Requirement 1: Update Deployment Configuration

**User Story:** As a DevOps engineer, I want to update the deployment configuration to use the Django backend, so that the Django backend becomes the active production service.

#### Acceptance Criteria

1. THE Deployment_Configuration SHALL replace the Node.js service definition with the Django service definitions in the root `render.yaml` file
2. THE Deployment_Configuration SHALL include all four Django services: web service (WSGI), WebSocket service (ASGI), Celery worker, and Celery beat scheduler
3. THE Deployment_Configuration SHALL configure the health check path to `/api/health` for the Django web service
4. THE Deployment_Configuration SHALL set the Python version to 3.11.0 for all Django services
5. THE Deployment_Configuration SHALL configure the build command to install dependencies, collect static files, and run migrations
6. THE Deployment_Configuration SHALL configure the start command to use Gunicorn for the web service with 4 workers and 120-second timeout
7. THE Deployment_Configuration SHALL configure the start command to use Daphne for the WebSocket service
8. THE Deployment_Configuration SHALL remove the Node.js cron job keepalive service
9. THE Root_Package_JSON SHALL update the build script to build only the Frontend (removing Node_Backend build steps)
10. THE Root_Package_JSON SHALL update the start script to serve the Frontend static files or proxy to Django

### Requirement 2: Configure Environment Variables

**User Story:** As a DevOps engineer, I want to configure all required environment variables for the Django backend, so that the backend can connect to databases, external services, and operate correctly.

#### Acceptance Criteria

1. THE Render_Service SHALL define the `DJANGO_SETTINGS_MODULE` environment variable set to `config.settings.production`
2. THE Render_Service SHALL define the `SECRET_KEY` environment variable with a securely generated value
3. THE Render_Service SHALL define the `ALLOWED_HOSTS` environment variable including the Render service hostname
4. THE Render_Service SHALL define the `CORS_ALLOWED_ORIGINS` environment variable including the Frontend domain
5. THE Render_Service SHALL define the `DATABASE_URL` environment variable pointing to the PostgreSQL database
6. THE Render_Service SHALL define the `REDIS_URL` environment variable pointing to the Redis instance
7. THE Render_Service SHALL define the `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` environment variables pointing to Redis
8. THE Render_Service SHALL define the `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` environment variables for file storage
9. THE Render_Service SHALL set the `DEBUG` environment variable to `false` for production
10. WHEN environment variables are missing or invalid, THEN THE Django_Backend SHALL log descriptive error messages and fail to start

### Requirement 3: Update Frontend API Configuration

**User Story:** As a frontend developer, I want the frontend to communicate with the Django backend, so that all application features work correctly with the new backend.

#### Acceptance Criteria

1. THE Frontend SHALL update the `VITE_API_URL` environment variable to point to the Django web service URL
2. THE Frontend SHALL use the `/api/v1/` prefix for all API endpoint calls (or maintain legacy `/api/` paths for compatibility)
3. THE Frontend SHALL handle JWT authentication tokens in the `Authorization: Bearer <token>` header format
4. THE Frontend SHALL parse ISO 8601 datetime format responses from the Django_Backend
5. THE Frontend SHALL handle boolean values as JSON booleans (`true`/`false`) not integers (`1`/`0`)
6. THE Frontend SHALL handle paginated responses with `page`, `limit`, `total`, and `data` fields
7. THE Frontend SHALL handle error responses with `error`, `message`, `code`, and `details` fields
8. THE Frontend SHALL update WebSocket connection URLs to point to the Django Channels service
9. WHEN the Django_Backend returns a 401 Unauthorized response, THEN THE Frontend SHALL redirect to the login page
10. WHEN the Django_Backend is unreachable, THEN THE Frontend SHALL display a user-friendly error message

### Requirement 4: Migrate Database Data

**User Story:** As a system administrator, I want to migrate all data from the Node.js database to the Django database, so that no data is lost during the backend transition.

#### Acceptance Criteria

1. THE Database_Migration SHALL export all data from the Node_Backend PostgreSQL database using the provided export script
2. THE Database_Migration SHALL validate the exported data for completeness and integrity before import
3. THE Database_Migration SHALL import all data into the Django_Backend PostgreSQL database using the provided import script
4. THE Database_Migration SHALL preserve all relationships between entities (foreign keys, many-to-many relationships)
5. THE Database_Migration SHALL preserve all timestamps (created_at, updated_at) in UTC timezone
6. THE Database_Migration SHALL preserve password hashes with bcrypt compatibility
7. THE Database_Migration SHALL preserve file upload references and Cloudinary URLs
8. THE Database_Migration SHALL verify data integrity after import using the provided verification script
9. WHEN data validation fails, THEN THE Database_Migration SHALL log specific errors and halt the import process
10. THE Database_Migration SHALL generate a migration audit report showing record counts before and after migration

### Requirement 5: Implement Rollback Capability

**User Story:** As a DevOps engineer, I want a documented rollback procedure, so that I can quickly revert to the Node.js backend if critical issues occur.

#### Acceptance Criteria

1. THE Rollback_Plan SHALL document the steps to revert the Render_Service to the previous Node.js deployment
2. THE Rollback_Plan SHALL document the steps to restore the Frontend API configuration to point to the Node_Backend
3. THE Rollback_Plan SHALL document the steps to restore the Node.js database from backup if data was modified
4. THE Rollback_Plan SHALL include estimated time to complete rollback (target: under 15 minutes)
5. THE Rollback_Plan SHALL identify rollback decision criteria (error rates, response times, feature failures)
6. THE Rollback_Plan SHALL document how to preserve Django database state for post-mortem analysis
7. WHEN a rollback is initiated, THEN THE Render_Service SHALL deploy the previous working Node.js configuration
8. WHEN a rollback is initiated, THEN THE Frontend SHALL be updated to use the Node_Backend API URL
9. THE Rollback_Plan SHALL be tested in a staging environment before production deployment
10. THE Rollback_Plan SHALL include contact information for escalation if rollback fails

### Requirement 6: Verify Backend Functionality

**User Story:** As a QA engineer, I want to verify all backend functionality works correctly, so that I can confirm the Django backend is production-ready.

#### Acceptance Criteria

1. THE Health_Check SHALL return a 200 OK response with database, Redis, and Celery status
2. THE Django_Backend SHALL successfully authenticate users with valid credentials
3. THE Django_Backend SHALL successfully handle CRUD operations for all 19 database models
4. THE Django_Backend SHALL successfully upload files to Cloudinary and return valid URLs
5. THE Django_Backend SHALL successfully execute background tasks via Celery workers
6. THE Django_Backend SHALL successfully establish WebSocket connections via Django Channels
7. THE Django_Backend SHALL successfully cache frequently accessed data in Redis
8. THE Django_Backend SHALL return responses within acceptable performance thresholds (95th percentile < 500ms for read operations)
9. WHEN the Django_Backend encounters errors, THEN it SHALL return standardized error responses with appropriate HTTP status codes
10. THE Django_Backend SHALL pass all existing integration tests and property-based tests

### Requirement 7: Remove Legacy Node.js Backend

**User Story:** As a developer, I want to remove the Node.js backend code, so that the codebase is cleaner and maintenance is simplified.

#### Acceptance Criteria

1. THE Node_Backend SHALL be archived to a separate Git branch before deletion
2. THE System SHALL delete the `server/` directory containing the Node_Backend code
3. THE System SHALL remove Node_Backend dependencies from the root `package.json` file
4. THE System SHALL remove Node_Backend-specific scripts from the root `package.json` file
5. THE System SHALL update the root README.md to document the Django_Backend as the active backend
6. THE System SHALL remove or update documentation files that reference the Node_Backend
7. THE System SHALL preserve migration scripts in the `rotc_backend/scripts/` directory for reference
8. WHEN the Node_Backend code is removed, THEN THE Frontend build process SHALL still complete successfully
9. WHEN the Node_Backend code is removed, THEN THE Deployment_Configuration SHALL still be valid
10. THE System SHALL create a migration completion document summarizing what was removed and where archives are located

### Requirement 8: Update Documentation

**User Story:** As a developer, I want updated documentation, so that I understand how to work with the Django backend.

#### Acceptance Criteria

1. THE Documentation SHALL update the main README.md to describe the Django_Backend architecture
2. THE Documentation SHALL update setup instructions to reference Django installation and configuration
3. THE Documentation SHALL document all Environment_Variable requirements for local development and production
4. THE Documentation SHALL document the API endpoint structure with `/api/v1/` prefix
5. THE Documentation SHALL document authentication flow using JWT tokens
6. THE Documentation SHALL document how to run Django migrations and management commands
7. THE Documentation SHALL document how to run Celery workers and beat scheduler locally
8. THE Documentation SHALL document how to run Django tests and property-based tests
9. THE Documentation SHALL document the deployment process to Render.com using the Django render.yaml
10. THE Documentation SHALL include troubleshooting guides for common Django backend issues

### Requirement 9: Deploy to Production

**User Story:** As a DevOps engineer, I want to deploy the Django backend to production, so that users can access the application with the new backend.

#### Acceptance Criteria

1. THE Deployment SHALL first deploy to a staging environment for validation
2. THE Deployment SHALL run all integration tests in the staging environment
3. THE Deployment SHALL verify all Frontend features work correctly in staging
4. WHEN staging validation passes, THEN THE Deployment SHALL proceed to production deployment
5. THE Deployment SHALL create a database backup before production deployment
6. THE Deployment SHALL deploy all four Django services (web, channels, celery worker, celery beat) simultaneously
7. THE Deployment SHALL verify all services reach "Live" status in the Render dashboard
8. THE Deployment SHALL verify the Health_Check endpoint returns healthy status
9. THE Deployment SHALL monitor error rates and response times for the first 24 hours
10. WHEN error rates exceed 5% or response times exceed 1 second (95th percentile), THEN THE Deployment SHALL trigger the Rollback_Plan

### Requirement 10: Validate Data Integrity

**User Story:** As a system administrator, I want to validate data integrity after migration, so that I can confirm all data was transferred correctly.

#### Acceptance Criteria

1. THE Validation SHALL verify record counts match between source and destination databases for all 19 models
2. THE Validation SHALL verify foreign key relationships are intact (no orphaned records)
3. THE Validation SHALL verify all user passwords authenticate correctly with the Django_Backend
4. THE Validation SHALL verify all file upload URLs are accessible and return valid images/documents
5. THE Validation SHALL verify all timestamps are in UTC timezone and match source data
6. THE Validation SHALL verify all boolean fields have correct true/false values
7. THE Validation SHALL verify all many-to-many relationships are preserved
8. THE Validation SHALL verify all unique constraints are enforced
9. WHEN data integrity issues are detected, THEN THE Validation SHALL generate a detailed report with specific discrepancies
10. THE Validation SHALL use property-based testing to verify round-trip data serialization (database → API → JSON → API → database)
