# Implementation Plan: Firebase Migration

## Overview

This implementation plan guides the migration of the ROTC Grading System from Vercel to Firebase hosting. The migration involves creating Firebase configuration files, containerizing the server application for Cloud Run, updating CORS settings, creating deployment scripts, and thoroughly testing the migrated application. Tasks are organized to build incrementally, with checkpoints to ensure each phase works before proceeding.

## Tasks

- [ ] 1. Initialize Firebase project and configuration
  - Create Firebase project in Google Cloud Console (or use existing)
  - Install Firebase CLI: `npm install -g firebase-tools`
  - Authenticate: `firebase login`
  - Initialize Firebase in project root: `firebase init`
  - Create firebase.json with hosting configuration
  - Create .firebaserc with project aliases
  - _Requirements: 1.1, 4.2_

- [ ] 2. Configure Firebase Hosting for client application
  - [ ] 2.1 Create firebase.json hosting configuration
    - Set public directory to "client/dist"
    - Configure rewrite rules for /api/** to Cloud Run
    - Configure rewrite rules for /uploads/** to Cloud Run
    - Add SPA fallback rule (** → /index.html)
    - Configure cache headers for different asset types
    - _Requirements: 1.3, 1.4, 1.5, 3.1, 3.2, 7.2, 7.3, 7.4_

  - [ ]* 2.2 Write unit test for firebase.json validation
    - Parse firebase.json and verify structure
    - Verify hosting.public is "client/dist"
    - Verify rewrite rules exist for API and uploads
    - Verify cache header configurations
    - _Requirements: 1.3, 1.4, 1.5_

- [ ] 3. Create Dockerfile for server containerization
  - [ ] 3.1 Write Dockerfile for Node.js server
    - Use node:18-slim base image
    - Copy server package files and install dependencies
    - Copy server source code
    - Create uploads directory
    - Expose port 8080
    - Set CMD to start server
    - _Requirements: 2.3, 2.7_

  - [ ]* 3.2 Test Docker container locally
    - Build container: `docker build -t rotc-server-test .`
    - Run container: `docker run -p 8080:8080 rotc-server-test`
    - Test health endpoint: `curl http://localhost:8080/health`
    - Verify server starts and responds correctly
    - _Requirements: 2.3, 2.5_

- [ ] 4. Update server CORS configuration
  - [ ] 4.1 Add Firebase Hosting domains to allowed origins
    - Add Firebase Hosting URLs to allowedOrigins array
    - Support environment variable for dynamic hosting URL
    - Update CORS middleware to handle Firebase domains
    - Test CORS with credentials: true
    - _Requirements: 3.3_

  - [ ]* 4.2 Write integration test for CORS configuration
    - Make cross-origin request from Firebase domain
    - Verify CORS headers are present
    - Test preflight OPTIONS request
    - _Requirements: 3.3_

- [ ] 5. Create Cloud Build configuration
  - [ ] 5.1 Write cloudbuild.yaml for automated deployment
    - Configure Docker build step
    - Configure container push to Container Registry
    - Configure Cloud Run deployment step
    - Set environment variables in deployment
    - Configure region and platform settings
    - _Requirements: 2.2, 2.3, 6.2, 6.3_

  - [ ]* 5.2 Validate cloudbuild.yaml syntax
    - Use gcloud builds submit --config cloudbuild.yaml --dry-run
    - Verify configuration is valid
    - _Requirements: 6.5_

- [ ] 6. Create deployment script
  - [ ] 6.1 Write deploy.sh bash script
    - Check for Firebase CLI installation
    - Parse environment argument (default, staging, dev)
    - Run build process (npm run build)
    - Verify build output exists
    - Build and deploy Cloud Run service
    - Deploy to Firebase Hosting
    - Verify deployment with health check
    - Handle errors with clear messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.2 Test deployment script with dry run
    - Run script with test environment
    - Verify error handling for missing dependencies
    - Verify error handling for build failures
    - _Requirements: 6.5_

- [ ] 7. Configure environment variables in Cloud Run
  - Set DATABASE_URL or SUPABASE_URL
  - Set CLOUDINARY_URL or individual Cloudinary credentials
  - Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
  - Set NODE_ENV to production
  - Set FIREBASE_HOSTING_URL for CORS
  - Set REDIRECT_TARGET_HOST to Firebase domain
  - Verify PORT is set by Cloud Run (8080)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Add deployment scripts to package.json
  - Add "deploy" script: "bash scripts/deploy.sh"
  - Add "deploy:staging" script: "bash scripts/deploy.sh staging"
  - Add "deploy:dev" script: "bash scripts/deploy.sh dev"
  - Move deploy.sh to scripts/ directory
  - Make deploy.sh executable: `chmod +x scripts/deploy.sh`
  - _Requirements: 6.1, 6.4_

- [ ] 9. Checkpoint - Test local Docker deployment
  - Build Docker container locally
  - Run container with environment variables
  - Test all API endpoints locally
  - Verify database connectivity
  - Verify file uploads work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Deploy to Firebase staging environment
  - [ ] 10.1 Create staging Firebase project
    - Create new Firebase project for staging
    - Add staging alias to .firebaserc
    - Configure staging environment variables in Cloud Run
    - _Requirements: 6.4_

  - [ ] 10.2 Run deployment to staging
    - Execute: `npm run deploy:staging`
    - Verify build completes successfully
    - Verify Cloud Run deployment succeeds
    - Verify Firebase Hosting deployment succeeds
    - _Requirements: 6.2, 6.3_

  - [ ]* 10.3 Write integration test for static asset serving
    - **Property 3: Cache Header Configuration**
    - Request index.html and verify status 200
    - Request JS bundle and verify cache header max-age=31536000
    - Request image and verify cache header max-age=604800
    - Request HTML and verify cache header no-cache
    - **Validates: Requirements 1.5, 7.2, 7.4**

  - [ ]* 10.4 Write integration test for SPA routing
    - **Property 2: SPA Fallback Routing**
    - Request non-existent routes (e.g., /dashboard/test)
    - Verify response status is 200
    - Verify response contains index.html content
    - Test multiple random paths
    - **Validates: Requirements 1.4**

  - [ ]* 10.5 Write integration test for API proxying
    - **Property 4: API Endpoint Preservation**
    - **Property 5: Request Proxying**
    - Test /api/health endpoint
    - Test authenticated endpoints
    - Test POST/PUT/DELETE endpoints
    - Verify all responses are correct
    - **Validates: Requirements 2.4, 3.1, 3.2**

  - [ ]* 10.6 Write integration test for header forwarding
    - **Property 6: Header Preservation**
    - Make API request with Authorization header
    - Make API request with custom headers
    - Verify backend receives all headers
    - **Validates: Requirements 3.4**

  - [ ]* 10.7 Write integration test for compression
    - **Property 7: Compression Consistency**
    - Request large API response with Accept-Encoding: gzip
    - Verify Content-Encoding header is present
    - Request static asset and verify compression
    - **Validates: Requirements 7.1, 9.5**

- [ ] 11. Checkpoint - Verify staging deployment
  - Run all integration tests against staging
  - Manually test authentication flow
  - Test file upload/download
  - Test database operations (CRUD)
  - Verify PWA functionality
  - Check performance metrics
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Create migration validation checklist
  - Document all API endpoints to test
  - Document authentication test scenarios
  - Document file upload test scenarios
  - Document database operation tests
  - Document PWA functionality tests
  - Create performance baseline measurements
  - _Requirements: 11.1_

- [ ] 13. Deploy to Firebase production environment
  - [ ] 13.1 Configure production Firebase project
    - Verify production Firebase project exists
    - Add production alias to .firebaserc
    - Configure production environment variables in Cloud Run
    - Set up custom domain (if applicable)
    - _Requirements: 6.4_

  - [ ] 13.2 Run deployment to production
    - Execute: `npm run deploy`
    - Verify build completes successfully
    - Verify Cloud Run deployment succeeds
    - Verify Firebase Hosting deployment succeeds
    - _Requirements: 6.2, 6.3, 6.6_

  - [ ]* 13.3 Run full integration test suite on production
    - Run all integration tests from task 10
    - Verify all tests pass
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 14. Perform manual validation testing
  - Test user authentication (cadet, staff, admin)
  - Test grade management functionality
  - Test attendance recording
  - Test excuse document uploads
  - Test report generation
  - Test PWA installation and offline mode
  - Test push notifications
  - Verify performance is acceptable
  - Test on multiple browsers and devices
  - _Requirements: 11.3, 11.4, 11.5, 11.6_

- [ ] 15. Document rollback procedure
  - [ ] 15.1 Create rollback documentation
    - Document steps to revert DNS to Vercel
    - Document how to restore Vercel deployment
    - Document data synchronization requirements
    - Document how to run both deployments simultaneously
    - _Requirements: 12.1, 12.5_

  - [ ] 15.2 Verify Vercel configuration is preserved
    - Check that Vercel config files still exist
    - Verify Vercel deployment is still active
    - Test Vercel deployment still works
    - _Requirements: 12.2, 12.3_

- [ ] 16. Monitor production deployment
  - Monitor Cloud Run logs for errors
  - Monitor Firebase Hosting analytics
  - Check /api/health endpoint regularly
  - Monitor database connectivity
  - Monitor performance metrics
  - Set up alerting for errors or performance degradation
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 17. Final checkpoint - Migration complete
  - Verify all automated tests pass
  - Verify manual testing checklist is complete
  - Verify performance is within acceptable range
  - Verify no critical issues in production
  - Verify rollback procedure is documented
  - Monitor production for 48 hours
  - Get stakeholder approval
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster migration
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at critical stages
- Integration tests validate correctness properties from the design document
- The migration can be rolled back at any point by reverting DNS to Vercel
- Keep Vercel deployment active during initial migration phase for safety
- Monitor production closely for the first 48 hours after migration
