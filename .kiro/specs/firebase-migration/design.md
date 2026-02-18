# Design Document: Firebase Migration

## Overview

This design outlines the migration of the ROTC Grading System from Vercel to Firebase hosting. The migration involves three main components:

1. **Firebase Hosting** for serving the React/Vite client application
2. **Cloud Run** for hosting the Node.js/Express server (preferred over Firebase Functions due to better support for long-running connections and existing Express apps)
3. **Firebase CLI and configuration** for deployment automation

The design maintains the existing application architecture while adapting the deployment infrastructure. The client application will be served from Firebase Hosting's global CDN, and API requests will be proxied to a Cloud Run service running the Express server.

### Key Design Decisions

- **Cloud Run over Firebase Functions**: Cloud Run is chosen because it supports containerized applications, handles long-running connections better (important for SSE), has no cold start timeout limitations, and works seamlessly with existing Express applications without refactoring.
- **Rewrite rules for API proxying**: Firebase Hosting rewrite rules will proxy `/api/*` and `/uploads/*` requests to the Cloud Run backend.
- **Environment-based configuration**: Multiple Firebase projects (or targets) for development, staging, and production environments.
- **Gradual migration**: The design supports running both Vercel and Firebase simultaneously during the transition period.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Hosting                          │
│                    (Global CDN)                              │
│                                                              │
│  • Serves static files from client/dist                     │
│  • Handles SPA routing (fallback to index.html)             │
│  • Proxies /api/* and /uploads/* to Cloud Run              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ /api/*, /uploads/*
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Cloud Run Service                       │
│                   (Node.js/Express Server)                   │
│                                                              │
│  • Handles all API endpoints                                │
│  • Manages authentication and authorization                 │
│  • Processes file uploads                                   │
│  • Connects to database (PostgreSQL/SQLite)                 │
│  • Serves uploaded files from /uploads                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Database queries
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│                                                              │
│  • PostgreSQL (Supabase) - Production                       │
│  • SQLite - Development/Testing                             │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Static Asset Requests**: User requests HTML/CSS/JS → Firebase Hosting serves from CDN → Browser renders
2. **API Requests**: User makes API call → Firebase Hosting rewrites to Cloud Run → Express handles request → Response returned
3. **SPA Navigation**: User navigates to /dashboard → Firebase Hosting serves index.html → React Router handles routing
4. **File Uploads**: User uploads file → API request to /api/images → Cloud Run processes → Stores in Cloudinary or local storage → Returns URL

## Components and Interfaces

### 1. Firebase Configuration Files

#### firebase.json

The main Firebase configuration file that defines hosting rules, rewrites, and headers.

```json
{
  "hosting": {
    "public": "client/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "rotc-server",
          "region": "us-central1"
        }
      },
      {
        "source": "/uploads/**",
        "run": {
          "serviceId": "rotc-server",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|webp|svg|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=604800, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/manifest.json",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      }
    ]
  }
}
```

**Key Configuration Elements**:
- `public`: Points to the built client application directory
- `rewrites`: Defines URL patterns and their routing behavior
  - API and uploads routes are proxied to Cloud Run
  - All other routes fall back to index.html for SPA routing
- `headers`: Sets cache control policies for different asset types

#### .firebaserc

Defines Firebase project aliases for different environments.

```json
{
  "projects": {
    "default": "rotc-grading-prod",
    "staging": "rotc-grading-staging",
    "dev": "rotc-grading-dev"
  }
}
```

### 2. Cloud Run Configuration

#### Dockerfile

Containerizes the Node.js server application for Cloud Run deployment.

```dockerfile
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
```

**Design Notes**:
- Uses Node 18 slim image for smaller container size
- Only installs production dependencies
- Creates uploads directory for file storage
- Exposes port 8080 (Cloud Run default)
- Cloud Run will inject the PORT environment variable

#### cloudbuild.yaml (Optional)

Automates container building and deployment using Cloud Build.

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/rotc-server:$SHORT_SHA', '-f', 'Dockerfile', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/rotc-server:$SHORT_SHA']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'rotc-server'
      - '--image=gcr.io/$PROJECT_ID/rotc-server:$SHORT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=NODE_ENV=production'

images:
  - 'gcr.io/$PROJECT_ID/rotc-server:$SHORT_SHA'
```

### 3. Deployment Scripts

#### deploy.sh

Bash script for deploying both client and server to Firebase.

```bash
#!/bin/bash

set -e  # Exit on error

echo "Starting Firebase deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Error: Firebase CLI is not installed. Install with: npm install -g firebase-tools"
    exit 1
fi

# Parse environment argument (default to production)
ENV=${1:-default}
echo "Deploying to environment: $ENV"

# Step 1: Build the client application
echo "Building client application..."
npm run build

# Verify build output exists
if [ ! -d "client/dist" ]; then
    echo "Error: Client build failed. client/dist directory not found."
    exit 1
fi

# Step 2: Build and deploy Cloud Run service
echo "Building and deploying server to Cloud Run..."
gcloud builds submit --config cloudbuild.yaml --project=$(firebase use | grep "Now using project" | awk '{print $4}')

# Step 3: Deploy to Firebase Hosting
echo "Deploying client to Firebase Hosting..."
firebase deploy --only hosting -P $ENV

# Step 4: Verify deployment
echo "Verifying deployment..."
HOSTING_URL=$(firebase hosting:channel:list -P $ENV | grep "live" | awk '{print $2}')
echo "Checking health endpoint..."
curl -f "$HOSTING_URL/api/health" || echo "Warning: Health check failed"

echo "Deployment complete!"
echo "Application URL: $HOSTING_URL"
```

#### package.json scripts

Add deployment scripts to the root package.json:

```json
{
  "scripts": {
    "build": "npm install --prefix server && npm install --prefix client && npm run build --prefix client",
    "start": "cd server && node server.js",
    "deploy": "bash scripts/deploy.sh",
    "deploy:staging": "bash scripts/deploy.sh staging",
    "deploy:dev": "bash scripts/deploy.sh dev"
  }
}
```

### 4. Server Modifications

#### Port Configuration

The server already uses `process.env.PORT`, which is compatible with Cloud Run. No changes needed to server.js for port binding.

```javascript
const PORT = parseInt(process.env.PORT) || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on port ${PORT}`);
});
```

#### CORS Configuration

Update CORS to allow requests from Firebase Hosting domain:

```javascript
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5000',
    'https://rotc-grading-prod.web.app',
    'https://rotc-grading-prod.firebaseapp.com',
    'https://rotc-grading-staging.web.app',
    'https://rotc-grading-staging.firebaseapp.com',
    process.env.FIREBASE_HOSTING_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

#### File Upload Storage

For Cloud Run, file uploads should be stored in Cloud Storage instead of local filesystem (which is ephemeral). However, for initial migration, we can keep local storage and add Cloud Storage later.

**Option 1: Keep local storage (temporary)**
- Works for initial migration
- Files are lost on container restart
- Suitable if Cloudinary is already handling most uploads

**Option 2: Use Cloud Storage (recommended for production)**
- Persistent storage
- Requires updating multer configuration
- Better for scalability

```javascript
// Example Cloud Storage integration (future enhancement)
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Multer Cloud Storage configuration
const multerGCS = require('multer-cloud-storage');
const upload = multer({
    storage: multerGCS.storageEngine({
        bucket: bucket,
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GCS_KEYFILE,
        destination: 'uploads/'
    })
});
```

### 5. Environment Variables Configuration

Environment variables are set in Cloud Run service configuration. They can be set via:

1. **Firebase CLI**:
```bash
firebase functions:config:set \
  database.url="postgresql://..." \
  cloudinary.url="cloudinary://..." \
  vapid.public_key="..." \
  vapid.private_key="..."
```

2. **gcloud CLI**:
```bash
gcloud run services update rotc-server \
  --set-env-vars="DATABASE_URL=postgresql://...,CLOUDINARY_URL=cloudinary://..." \
  --region=us-central1
```

3. **Google Cloud Console**: Manually set environment variables in the Cloud Run service settings.

**Required Environment Variables**:
- `NODE_ENV`: production/staging/development
- `PORT`: Set automatically by Cloud Run (8080)
- `DATABASE_URL` or `SUPABASE_URL`: Database connection string
- `CLOUDINARY_URL` or individual Cloudinary credentials
- `VAPID_PUBLIC_KEY`: Web push notification public key
- `VAPID_PRIVATE_KEY`: Web push notification private key
- `REDIRECT_ENABLED`: Host-based redirect flag
- `REDIRECT_FROM_HOSTS`: Comma-separated list of old hosts
- `REDIRECT_TARGET_HOST`: New Firebase hosting domain

### 6. Database Considerations

#### PostgreSQL (Supabase)

No changes required. Cloud Run can connect to Supabase using the existing connection string.

**Connection Configuration**:
- Use `DATABASE_URL` or `SUPABASE_URL` environment variable
- Ensure Cloud Run service has network access to Supabase
- Consider using connection pooling for better performance

#### SQLite

SQLite requires persistent storage, which is challenging in Cloud Run's ephemeral filesystem.

**Options**:
1. **Mount Cloud Storage FUSE** (not recommended - performance issues)
2. **Use Cloud SQL with SQLite** (not supported)
3. **Migrate to PostgreSQL** (recommended for production)
4. **Use Firestore** (requires significant refactoring)

**Recommendation**: For production, use PostgreSQL (Supabase). For development/testing, SQLite can work with the understanding that data is lost on container restart.

## Data Models

No changes to existing data models. The migration is infrastructure-only and does not affect the application's data structures, database schema, or API contracts.

### Existing Data Models (Reference)

The application uses the following main data models (unchanged):

- **Users**: Authentication and user profiles (cadets, staff, admins)
- **Grades**: Merit/demerit records and grade calculations
- **Attendance**: Attendance tracking and excuse management
- **Notifications**: Push notification subscriptions and messages
- **Settings**: Application configuration and preferences
- **Sync Events**: Real-time synchronization events for SSE

All database tables, relationships, and queries remain identical after migration.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Build Output Consistency

*For any* execution of the build process, the client/dist directory should be created and contain at minimum an index.html file and an assets/ directory with JavaScript and CSS bundles.

**Validates: Requirements 1.2, 5.4**

### Property 2: SPA Fallback Routing

*For any* HTTP request to a non-existent route path (excluding /api/* and /uploads/*), Firebase Hosting should return the contents of index.html with a 200 status code.

**Validates: Requirements 1.4**

### Property 3: Cache Header Configuration

*For any* static asset served by Firebase Hosting, the Cache-Control header should match the expected value based on file type: immutable assets (JS/CSS with hashes) should have max-age=31536000, images should have max-age=604800, and HTML files should have no-cache.

**Validates: Requirements 1.5, 7.2, 7.4**

### Property 4: API Endpoint Preservation

*For any* API endpoint that existed in the Vercel deployment, the same endpoint should be accessible and return valid responses in the Firebase deployment with identical request/response contracts.

**Validates: Requirements 2.4, 11.2**

### Property 5: Request Proxying

*For any* HTTP request to paths matching /api/* or /uploads/*, Firebase Hosting should proxy the request to the Cloud Run backend service and return the backend's response to the client.

**Validates: Requirements 3.1, 3.2**

### Property 6: Header Preservation

*For any* HTTP request proxied from Firebase Hosting to Cloud Run, all request headers (including Authorization, Content-Type, and custom headers) should be forwarded to the backend without modification.

**Validates: Requirements 3.4**

### Property 7: Compression Consistency

*For any* API response or static asset larger than 1KB, the response should include a Content-Encoding header indicating compression (gzip or br) when the client supports it.

**Validates: Requirements 7.1, 9.5**

## Error Handling

### Build Failures

**Scenario**: The build process fails due to missing dependencies, syntax errors, or configuration issues.

**Handling**:
1. The build script should exit with a non-zero status code
2. Error messages should be logged to stderr with clear indication of the failure point
3. The deployment script should detect build failure and abort deployment
4. No partial or incomplete builds should be deployed to Firebase

**Implementation**:
```bash
# In deploy.sh
npm run build || {
    echo "Error: Build failed. Deployment aborted."
    exit 1
}
```

### Deployment Failures

**Scenario**: Firebase deployment fails due to authentication issues, network problems, or configuration errors.

**Handling**:
1. The deployment script should catch Firebase CLI errors
2. Error messages should include the specific failure reason (auth, network, config)
3. The script should exit with a non-zero status code
4. Previous deployment should remain active (Firebase's atomic deployment)

**Implementation**:
```bash
# In deploy.sh
firebase deploy --only hosting -P $ENV || {
    echo "Error: Firebase deployment failed. Previous version remains active."
    exit 1
}
```

### Cloud Run Service Failures

**Scenario**: The Cloud Run service fails to start due to container build errors, missing environment variables, or runtime crashes.

**Handling**:
1. Cloud Build should fail with clear error messages if container build fails
2. Cloud Run should keep the previous revision active if new deployment fails
3. Health check failures should prevent traffic routing to unhealthy instances
4. Application logs should be available in Cloud Logging for debugging

**Implementation**:
- Cloud Run automatically handles revision management
- Health checks defined in Cloud Run service configuration
- Application should log errors using console.error (captured by Cloud Logging)

### Database Connection Failures

**Scenario**: The server cannot connect to the database due to network issues, incorrect credentials, or database unavailability.

**Handling**:
1. The server should log connection errors with details
2. The /api/health endpoint should return database status as "disconnected"
3. The server should continue running and retry connections
4. API requests requiring database access should return 503 Service Unavailable

**Implementation**:
```javascript
// Already implemented in server.js
app.get('/api/health', (req, res) => {
    if (db.pool && isPostgres) {
        db.pool.query('SELECT 1', (err) => {
            if (err) {
                console.error('Health check DB error:', err);
                res.json({ 
                    status: 'ok', 
                    db: 'disconnected', 
                    type: 'postgres', 
                    timestamp: Date.now(), 
                    error: err.message 
                });
            } else {
                res.json({ 
                    status: 'ok', 
                    db: 'connected', 
                    type: 'postgres', 
                    timestamp: Date.now() 
                });
            }
        });
    }
});
```

### CORS Errors

**Scenario**: Requests from the client are blocked due to CORS policy mismatches.

**Handling**:
1. The server should include the client's Firebase Hosting domain in allowed origins
2. CORS errors should be logged on the server side
3. The client should receive a clear CORS error message in the browser console
4. Preflight OPTIONS requests should be handled correctly

**Implementation**:
```javascript
// Updated CORS configuration in server.js
const allowedOrigins = [
    'http://localhost:5173',
    'https://rotc-grading-prod.web.app',
    'https://rotc-grading-prod.firebaseapp.com',
    process.env.FIREBASE_HOSTING_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

### File Upload Failures

**Scenario**: File uploads fail due to size limits, storage quota, or network issues.

**Handling**:
1. The server should validate file size before processing
2. Upload errors should return appropriate HTTP status codes (413 for too large, 507 for storage full)
3. Partial uploads should be cleaned up
4. Error messages should indicate the specific failure reason

**Implementation**:
```javascript
// Multer error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ 
                message: 'File too large', 
                maxSize: '10MB' 
            });
        }
    }
    next(err);
});
```

### Environment Variable Missing

**Scenario**: Critical environment variables are not set in Cloud Run configuration.

**Handling**:
1. The server should check for required environment variables on startup
2. Missing critical variables should log warnings or errors
3. The server should use sensible defaults where possible
4. The /api/health endpoint should indicate configuration issues

**Implementation**:
```javascript
// Environment variable validation on startup
const requiredEnvVars = ['NODE_ENV'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
}

// Optional variables with defaults
const PORT = parseInt(process.env.PORT) || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';
```

## Testing Strategy

The migration testing strategy employs both unit tests and integration tests to ensure comprehensive coverage of the migration requirements. Testing is divided into three phases: pre-migration validation, migration execution, and post-migration verification.

### Testing Approach

**Unit Tests**: Verify specific configuration files, scripts, and individual components in isolation.

**Integration Tests**: Verify end-to-end functionality including client-server communication, database connectivity, and deployment workflows.

**Manual Testing**: Verify user-facing functionality, performance characteristics, and edge cases that are difficult to automate.

### Pre-Migration Validation Tests

These tests verify that the existing application is working correctly before migration begins.

**Test 1: Verify Current Deployment**
- Type: Integration test
- Purpose: Establish baseline functionality
- Steps:
  1. Run health check against current Vercel deployment
  2. Test all major API endpoints
  3. Verify authentication flow
  4. Test file upload/download
  5. Verify database connectivity
- Success Criteria: All tests pass, establishing a baseline for comparison

**Test 2: Verify Build Process**
- Type: Unit test
- Purpose: Ensure build works before migration
- Steps:
  1. Run `npm run build` from project root
  2. Verify client/dist directory is created
  3. Verify index.html exists
  4. Verify assets directory contains JS and CSS files
- Success Criteria: Build completes successfully with all expected outputs

### Migration Configuration Tests

These tests verify that Firebase configuration files are correct.

**Test 3: Validate firebase.json**
- Type: Unit test
- Purpose: Ensure Firebase configuration is valid
- Steps:
  1. Parse firebase.json as JSON
  2. Verify hosting.public points to "client/dist"
  3. Verify rewrite rules for /api/** and /uploads/**
  4. Verify SPA fallback rule exists
  5. Verify cache header configurations
- Success Criteria: All configuration elements are present and valid

**Test 4: Validate Dockerfile**
- Type: Unit test
- Purpose: Ensure container builds successfully
- Steps:
  1. Run `docker build -t rotc-server-test -f Dockerfile .`
  2. Verify build completes without errors
  3. Run container locally: `docker run -p 8080:8080 rotc-server-test`
  4. Test health endpoint: `curl http://localhost:8080/health`
- Success Criteria: Container builds and runs, health check returns 200

**Test 5: Validate Deployment Script**
- Type: Unit test
- Purpose: Ensure deployment script is executable and has correct logic
- Steps:
  1. Verify deploy.sh has execute permissions
  2. Run shellcheck on deploy.sh to catch syntax errors
  3. Verify script checks for Firebase CLI installation
  4. Verify script runs build before deployment
  5. Verify script handles errors correctly
- Success Criteria: Script passes validation and error handling checks

### Post-Migration Verification Tests

These tests verify that the migrated application works correctly on Firebase.

**Test 6: Verify Static Asset Serving**
- Type: Integration test
- Purpose: Ensure Firebase Hosting serves client correctly
- Steps:
  1. Request index.html from Firebase Hosting URL
  2. Verify response status is 200
  3. Verify Content-Type is text/html
  4. Request a JS bundle from /assets/
  5. Verify Cache-Control header is "public, max-age=31536000, immutable"
  6. Request manifest.json
  7. Verify it's accessible and has correct content
- Success Criteria: All static assets are served with correct headers
- **Feature: firebase-migration, Property 3: Cache Header Configuration**

**Test 7: Verify SPA Routing**
- Type: Integration test
- Purpose: Ensure client-side routing works
- Steps:
  1. Request a non-existent route (e.g., /dashboard/nonexistent)
  2. Verify response status is 200
  3. Verify response body contains index.html content
  4. Verify Content-Type is text/html
- Success Criteria: All non-API routes return index.html
- **Feature: firebase-migration, Property 2: SPA Fallback Routing**

**Test 8: Verify API Endpoint Proxying**
- Type: Integration test
- Purpose: Ensure API requests are proxied to Cloud Run
- Steps:
  1. Request /api/health from Firebase Hosting URL
  2. Verify response status is 200
  3. Verify response contains database status
  4. Test authenticated endpoint (e.g., /api/cadet/profile)
  5. Verify authentication works correctly
  6. Test POST endpoint (e.g., /api/attendance)
  7. Verify request body is received correctly
- Success Criteria: All API endpoints respond correctly
- **Feature: firebase-migration, Property 4: API Endpoint Preservation**
- **Feature: firebase-migration, Property 5: Request Proxying**

**Test 9: Verify Header Forwarding**
- Type: Integration test
- Purpose: Ensure request headers are preserved
- Steps:
  1. Make API request with Authorization header
  2. Verify backend receives the header
  3. Make API request with custom headers
  4. Verify backend receives all headers
- Success Criteria: All headers are forwarded correctly
- **Feature: firebase-migration, Property 6: Header Preservation**

**Test 10: Verify CORS Configuration**
- Type: Integration test
- Purpose: Ensure cross-origin requests work
- Steps:
  1. Make API request from Firebase Hosting domain
  2. Verify CORS headers are present in response
  3. Verify Access-Control-Allow-Origin includes the client domain
  4. Test preflight OPTIONS request
  5. Verify it returns correct CORS headers
- Success Criteria: CORS is configured correctly for client domain

**Test 11: Verify Database Connectivity**
- Type: Integration test
- Purpose: Ensure database operations work
- Steps:
  1. Test read operation (e.g., GET /api/cadet/profile)
  2. Verify data is returned correctly
  3. Test write operation (e.g., POST /api/attendance)
  4. Verify data is saved to database
  5. Test update operation (e.g., PUT /api/admin/grades)
  6. Verify data is updated correctly
  7. Test delete operation if applicable
  8. Verify data is deleted correctly
- Success Criteria: All CRUD operations work correctly

**Test 12: Verify File Upload/Download**
- Type: Integration test
- Purpose: Ensure file operations work
- Steps:
  1. Upload a test image via /api/images
  2. Verify upload succeeds and returns URL
  3. Request the uploaded image via /uploads/[filename]
  4. Verify image is returned correctly
  5. Verify Content-Type header is correct
- Success Criteria: File upload and download work correctly

**Test 13: Verify Environment Variables**
- Type: Integration test
- Purpose: Ensure environment variables are set correctly
- Steps:
  1. Check /api/health for database connection (requires DATABASE_URL)
  2. Test Cloudinary upload (requires CLOUDINARY_URL)
  3. Test web push notification (requires VAPID keys)
  4. Verify PORT is set correctly (should be 8080 in Cloud Run)
- Success Criteria: All environment-dependent features work

**Test 14: Verify Compression**
- Type: Integration test
- Purpose: Ensure responses are compressed
- Steps:
  1. Request a large API response with Accept-Encoding: gzip
  2. Verify Content-Encoding header is present
  3. Verify response is compressed
  4. Request a static asset
  5. Verify it's served compressed
- Success Criteria: Responses are compressed when appropriate
- **Feature: firebase-migration, Property 7: Compression Consistency**

**Test 15: Verify Performance**
- Type: Integration test
- Purpose: Ensure performance is comparable to Vercel
- Steps:
  1. Measure response time for /api/health (baseline)
  2. Measure response time for authenticated endpoints
  3. Measure response time for database queries
  4. Compare to Vercel baseline measurements
- Success Criteria: Response times are within 20% of Vercel baseline

**Test 16: Verify Build Process Integration**
- Type: Integration test
- Purpose: Ensure build runs correctly in deployment
- Steps:
  1. Run deployment script with clean environment
  2. Verify build executes successfully
  3. Verify client/dist is created
  4. Verify deployment proceeds after build
- Success Criteria: Build integrates correctly with deployment
- **Feature: firebase-migration, Property 1: Build Output Consistency**

### Property-Based Testing Configuration

For properties that can be tested with property-based testing, we will use the following configuration:

- **Library**: fast-check (for JavaScript/Node.js)
- **Iterations**: Minimum 100 per property test
- **Test Framework**: Jest or Mocha
- **Tag Format**: Each test includes a comment with the property reference

Example property test structure:

```javascript
// Feature: firebase-migration, Property 2: SPA Fallback Routing
describe('SPA Fallback Routing', () => {
    it('should return index.html for any non-API route', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.webPath({ noQueryParams: true }), // Generate random paths
                async (path) => {
                    // Skip API and uploads paths
                    fc.pre(!path.startsWith('/api') && !path.startsWith('/uploads'));
                    
                    const response = await fetch(`${FIREBASE_URL}${path}`);
                    const text = await response.text();
                    
                    // Should return 200 and contain index.html content
                    expect(response.status).toBe(200);
                    expect(text).toContain('<!DOCTYPE html>');
                    expect(text).toContain('id="root"');
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

### Manual Testing Checklist

After automated tests pass, perform manual testing:

1. **User Authentication Flow**
   - Log in as cadet, staff, and admin
   - Verify role-based access control
   - Test password reset flow

2. **Core Functionality**
   - Add/edit/delete grades
   - Record attendance
   - Upload excuse documents
   - Generate reports

3. **PWA Functionality**
   - Install PWA on mobile device
   - Test offline mode
   - Verify push notifications

4. **Performance**
   - Test with slow network connection
   - Verify page load times
   - Check for console errors

5. **Cross-Browser Testing**
   - Test on Chrome, Firefox, Safari
   - Test on mobile browsers
   - Verify responsive design

### Rollback Testing

Before considering migration complete, verify rollback capability:

1. Document current Firebase deployment URLs
2. Keep Vercel deployment active
3. Test switching DNS back to Vercel
4. Verify Vercel deployment still works
5. Document any data sync requirements

### Success Criteria

The migration is considered successful when:

1. All automated tests pass (Tests 1-16)
2. Manual testing checklist is complete with no critical issues
3. Performance is within 20% of Vercel baseline
4. All stakeholders approve the migration
5. Rollback procedure is documented and tested
6. Production traffic is successfully served from Firebase for 48 hours without critical issues
