# Design Document: Django Backend Activation

## Overview

This document provides the comprehensive design for migrating the ROTC Grading System from the Node.js/Express backend to the Django/Python backend as the active production system. The Django backend is feature-complete with all models, API endpoints, authentication, file uploads, caching, background tasks, WebSocket support, and comprehensive tests already implemented.

### Migration Scope

The migration involves:
- Updating deployment configurations to activate Django services
- Configuring environment variables for production
- Updating frontend API integration to communicate with Django
- Migrating data from Node.js PostgreSQL to Django PostgreSQL
- Implementing rollback procedures for risk mitigation
- Verifying functionality and data integrity
- Removing legacy Node.js backend code
- Updating documentation

### Success Criteria

- All four Django services (web, channels, celery worker, celery beat) deployed and healthy
- Frontend successfully communicates with Django backend
- All data migrated with 100% integrity verification
- All features functional with acceptable performance (95th percentile < 500ms)
- Zero data loss during migration
- Rollback capability tested and documented

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        FE[React Frontend<br/>Vite + React Router]
        PWA[Progressive Web App<br/>Service Worker]
    end
    
    subgraph "Load Balancer"
        LB[Render.com Load Balancer]
    end
    
    subgraph "Django Services on Render.com"
        WEB[Django Web Service<br/>Gunicorn WSGI<br/>4 workers]
        CHAN[Django Channels Service<br/>Daphne ASGI<br/>WebSocket]
        CELW[Celery Worker<br/>Background Tasks<br/>2 concurrency]
        CELB[Celery Beat<br/>Periodic Scheduler]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>NeonDB<br/>Primary Database)]
        REDIS[(Redis<br/>Cache + Broker)]
        CLOUD[Cloudinary<br/>File Storage]
    end
    
    FE -->|HTTPS API Calls| LB
    FE -->|WSS WebSocket| LB
    PWA -.->|Offline Cache| FE
    
    LB -->|/api/*| WEB
    LB -->|/ws/*| CHAN
    
    WEB -->|Read/Write| PG
    WEB -->|Cache| REDIS
    WEB -->|Upload Files| CLOUD
    WEB -->|Queue Tasks| REDIS
    
    CHAN -->|Read/Write| PG
    CHAN -->|Pub/Sub| REDIS
    
    CELW -->|Consume Tasks| REDIS
    CELW -->|Read/Write| PG
    CELW -->|Upload Files| CLOUD
    
    CELB -->|Schedule Tasks| REDIS
    CELB -->|Read| PG
    
    style WEB fill:#4CAF50
    style CHAN fill:#2196F3
    style CELW fill:#FF9800
    style CELB fill:#9C27B0
    style PG fill:#336791
    style REDIS fill:#DC382D
    style CLOUD fill:#3448C5
```

### Deployment Architecture on Render.com

```mermaid
graph LR
    subgraph "Render.com Services"
        subgraph "Web Services"
            W1[rotc-django-web<br/>Python 3.11<br/>Starter Plan]
            W2[rotc-django-channels<br/>Python 3.11<br/>Starter Plan]
        end
        
        subgraph "Worker Services"
            WK1[rotc-celery-worker<br/>Python 3.11<br/>Starter Plan]
            WK2[rotc-celery-beat<br/>Python 3.11<br/>Starter Plan]
        end
    end
    
    subgraph "External Services"
        DB[(NeonDB PostgreSQL<br/>Serverless)]
        RD[(Redis<br/>Upstash/Redis Labs)]
        CL[Cloudinary<br/>Media Storage]
    end
    
    W1 --> DB
    W1 --> RD
    W1 --> CL
    
    W2 --> DB
    W2 --> RD
    
    WK1 --> DB
    WK1 --> RD
    WK1 --> CL
    
    WK2 --> DB
    WK2 --> RD
    
    style W1 fill:#4CAF50
    style W2 fill:#2196F3
    style WK1 fill:#FF9800
    style WK2 fill:#9C27B0
```

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Django
    participant PostgreSQL
    participant Redis
    participant Celery
    participant Cloudinary
    
    User->>Frontend: Login Request
    Frontend->>Django: POST /api/v1/auth/login
    Django->>PostgreSQL: Verify Credentials
    PostgreSQL-->>Django: User Data
    Django->>Redis: Cache Session
    Django-->>Frontend: JWT Token
    Frontend-->>User: Dashboard
    
    User->>Frontend: Upload File
    Frontend->>Django: POST /api/v1/files/upload
    Django->>Cloudinary: Upload File
    Cloudinary-->>Django: File URL
    Django->>PostgreSQL: Save File Record
    Django->>Redis: Queue Task
    Django-->>Frontend: File Metadata
    
    Redis->>Celery: Process Task
    Celery->>PostgreSQL: Update Records
    Celery->>Django: Notify via WebSocket
    Django-->>Frontend: Real-time Update
    Frontend-->>User: Notification
```

### Migration Workflow

```mermaid
graph TD
    START[Start Migration] --> BACKUP[Create Database Backup]
    BACKUP --> EXPORT[Export Node.js Data]
    EXPORT --> VALIDATE[Validate Export]
    VALIDATE --> IMPORT[Import to Django DB]
    IMPORT --> VERIFY[Verify Data Integrity]
    VERIFY --> DEPLOY[Deploy Django Services]
    DEPLOY --> CONFIG[Update Frontend Config]
    CONFIG --> TEST[Run Integration Tests]
    TEST --> DECISION{Tests Pass?}
    DECISION -->|Yes| MONITOR[Monitor Production]
    DECISION -->|No| ROLLBACK[Execute Rollback]
    MONITOR --> DECISION2{Metrics OK?}
    DECISION2 -->|Yes| CLEANUP[Remove Node.js Backend]
    DECISION2 -->|No| ROLLBACK
    ROLLBACK --> END[Migration Failed]
    CLEANUP --> SUCCESS[Migration Complete]
    
    style START fill:#4CAF50
    style SUCCESS fill:#4CAF50
    style ROLLBACK fill:#F44336
    style END fill:#F44336
```

## Components and Interfaces

### 1. Django Web Service (WSGI)

**Purpose**: Primary HTTP API server handling REST API requests

**Technology Stack**:
- Django 4.2+
- Django REST Framework 3.14+
- Gunicorn WSGI server
- Python 3.11

**Configuration**:
```python
# gunicorn.conf.py
bind = "0.0.0.0:$PORT"
workers = 4
worker_class = "sync"
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
preload_app = True
accesslog = "-"
errorlog = "-"
loglevel = "info"
```

**Endpoints**:
- `/api/v1/auth/*` - Authentication endpoints
- `/api/v1/cadets/*` - Cadet management
- `/api/v1/staff/*` - Staff management
- `/api/v1/activities/*` - Activity management
- `/api/v1/attendance/*` - Attendance tracking
- `/api/v1/grading/*` - Grading operations
- `/api/v1/files/*` - File upload/download
- `/api/v1/reports/*` - Report generation
- `/api/v1/messaging/*` - Messaging system
- `/api/health` - Health check endpoint

**Health Check Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "celery": "running"
  },
  "version": "1.0.0"
}
```

### 2. Django Channels Service (ASGI)

**Purpose**: WebSocket server for real-time bidirectional communication

**Technology Stack**:
- Django Channels 4.0+
- Daphne ASGI server
- Redis channel layer
- Python 3.11

**Configuration**:
```python
# daphne.conf.py
bind = "0.0.0.0"
port = "$PORT"
application = "config.asgi:application"
verbosity = 1
access_log = "-"
```

**WebSocket Endpoints**:
- `/ws/notifications/` - Real-time notifications
- `/ws/chat/{room_id}/` - Chat rooms
- `/ws/updates/` - Live data updates

**Message Format**:
```json
{
  "type": "notification",
  "data": {
    "id": "uuid",
    "message": "New grade posted",
    "timestamp": "2024-01-15T10:30:00Z",
    "priority": "high"
  }
}
```

### 3. Celery Worker Service

**Purpose**: Background task processing for asynchronous operations

**Technology Stack**:
- Celery 5.3+
- Redis broker
- Python 3.11

**Configuration**:
```python
# config/celery.py
CELERY_BROKER_URL = os.environ.get('REDIS_URL')
CELERY_RESULT_BACKEND = os.environ.get('REDIS_URL')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
```

**Task Types**:
- Email notifications
- Report generation (PDF)
- Data export operations
- File processing (OCR, compression)
- Batch operations (bulk grading)
- Data synchronization

### 4. Celery Beat Service

**Purpose**: Periodic task scheduler for recurring operations

**Technology Stack**:
- Celery Beat 5.3+
- Redis broker
- Python 3.11

**Scheduled Tasks**:
```python
# Periodic task schedule
CELERY_BEAT_SCHEDULE = {
    'cleanup-old-sessions': {
        'task': 'apps.authentication.tasks.cleanup_sessions',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    'generate-daily-reports': {
        'task': 'apps.reports.tasks.generate_daily_reports',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6 AM
    },
    'sync-attendance': {
        'task': 'apps.attendance.tasks.sync_attendance',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
}
```

### 5. Frontend API Client

**Purpose**: HTTP client for communicating with Django backend

**Technology Stack**:
- Axios HTTP client
- React Query for caching
- JWT token management

**Configuration**:
```javascript
// src/utils/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 6. Database Migration Scripts

**Purpose**: Transfer data from Node.js to Django database

**Scripts**:

1. **Export Script** (`rotc_backend/scripts/export_nodejs_data.py`):
   - Connects to Node.js PostgreSQL database
   - Exports all tables to JSON files
   - Validates data completeness
   - Generates export manifest

2. **Import Script** (`rotc_backend/scripts/import_django_data.py`):
   - Reads JSON export files
   - Maps Node.js schema to Django models
   - Imports data with relationship preservation
   - Handles data type conversions

3. **Validation Script** (`rotc_backend/scripts/verify_migration.py`):
   - Compares record counts
   - Verifies foreign key integrity
   - Validates data consistency
   - Generates verification report

## Data Models

### Database Schema Mapping

The Django backend implements 19 models that map to the Node.js database schema:

| Node.js Table | Django Model | App | Notes |
|---------------|--------------|-----|-------|
| users | User | authentication | Extended Django User model |
| cadets | Cadet | cadets | Profile information |
| staff | Staff | staff | Staff profiles |
| activities | Activity | activities | Training activities |
| attendance | Attendance | attendance | Attendance records |
| grades | Grade | grading | Grade entries |
| grade_categories | GradeCategory | grading | Grade categories |
| files | File | files | File metadata |
| reports | Report | reports | Generated reports |
| messages | Message | messaging | Chat messages |
| notifications | Notification | messaging | User notifications |
| audit_logs | AuditLog | system | Audit trail |
| settings | SystemSetting | system | System configuration |

### Data Type Conversions

| Node.js Type | Django Type | Conversion Notes |
|--------------|-------------|------------------|
| SERIAL | AutoField | Auto-incrementing primary key |
| VARCHAR | CharField | Max length preserved |
| TEXT | TextField | Unlimited text |
| INTEGER | IntegerField | 32-bit integer |
| BOOLEAN | BooleanField | True/False (not 1/0) |
| TIMESTAMP | DateTimeField | ISO 8601 format, UTC |
| DATE | DateField | YYYY-MM-DD format |
| DECIMAL | DecimalField | Precision preserved |
| JSON | JSONField | Native JSON support |
| UUID | UUIDField | UUID v4 |

### Password Migration

Node.js uses bcrypt for password hashing. Django supports bcrypt through the `django[bcrypt]` package:

```python
# Django password hasher configuration
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
]
```

Migration strategy:
1. Export password hashes from Node.js database
2. Prefix with `bcrypt_sha256$` for Django compatibility
3. Import into Django User model
4. Users can log in with existing passwords
5. Passwords will be upgraded to Django's preferred hasher on next login



## Detailed Implementation Design

### 1. Deployment Configuration Updates

#### 1.1 Root render.yaml Replacement

**Current Configuration** (Node.js):
```yaml
services:
  - type: web
    name: MSU-SND-RGMS-1
    env: node
    buildCommand: npm run build
    startCommand: npm start
    autoDeploy: true
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: ENABLE_CADET_AUTO_SYNC
        value: "false"
  - type: cron
    name: rotc-grading-keepalive
    schedule: "*/5 * * * *"
    env: docker
    command: 'curl -s https://msu-snd-rgms-1.onrender.com/health || true'
```

**New Configuration** (Django):
```yaml
services:
  # Django Web Service (WSGI)
  - type: web
    name: rotc-django-web
    env: python
    region: oregon
    plan: starter
    rootDir: rotc_backend
    buildCommand: |
      pip install --upgrade pip
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
      python manage.py migrate --noinput
    startCommand: gunicorn config.wsgi:application --config gunicorn.conf.py
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: DJANGO_SETTINGS_MODULE
        value: config.settings.production
      - key: DEBUG
        value: false
      - key: SECRET_KEY
        sync: false
      - key: RENDER_EXTERNAL_HOSTNAME
        sync: false
      - key: ALLOWED_HOSTS
        sync: false
      - key: CORS_ALLOWED_ORIGINS
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: CELERY_BROKER_URL
        sync: false
      - key: CELERY_RESULT_BACKEND
        sync: false
    healthCheckPath: /api/health
    autoDeploy: true

  # Django Channels Service (ASGI for WebSocket)
  - type: web
    name: rotc-django-channels
    env: python
    region: oregon
    plan: starter
    rootDir: rotc_backend
    buildCommand: |
      pip install --upgrade pip
      pip install -r requirements.txt
    startCommand: daphne -b 0.0.0.0 -p $PORT config.asgi:application
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: DJANGO_SETTINGS_MODULE
        value: config.settings.production
      - key: DEBUG
        value: false
      - key: SECRET_KEY
        sync: false
      - key: RENDER_EXTERNAL_HOSTNAME
        sync: false
      - key: ALLOWED_HOSTS
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
    autoDeploy: true

  # Celery Worker Service
  - type: worker
    name: rotc-celery-worker
    env: python
    region: oregon
    plan: starter
    rootDir: rotc_backend
    buildCommand: |
      pip install --upgrade pip
      pip install -r requirements.txt
    startCommand: celery -A config worker --loglevel=info --concurrency=2
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: DJANGO_SETTINGS_MODULE
        value: config.settings.production
      - key: DEBUG
        value: false
      - key: SECRET_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: CELERY_BROKER_URL
        sync: false
      - key: CELERY_RESULT_BACKEND
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
    autoDeploy: true

  # Celery Beat Service (Periodic Tasks)
  - type: worker
    name: rotc-celery-beat
    env: python
    region: oregon
    plan: starter
    rootDir: rotc_backend
    buildCommand: |
      pip install --upgrade pip
      pip install -r requirements.txt
    startCommand: celery -A config beat --loglevel=info
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: DJANGO_SETTINGS_MODULE
        value: config.settings.production
      - key: DEBUG
        value: false
      - key: SECRET_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: CELERY_BROKER_URL
        sync: false
      - key: CELERY_RESULT_BACKEND
        sync: false
    autoDeploy: true
```

**Key Changes**:
- Removed Node.js web service
- Removed cron job keepalive service (no longer needed)
- Added 4 Django services (web, channels, celery worker, celery beat)
- Changed `env` from `node` to `python`
- Updated `rootDir` to `rotc_backend`
- Changed health check path to `/api/health`
- Updated build and start commands for Python/Django

#### 1.2 Root package.json Updates

**Current Scripts**:
```json
{
  "scripts": {
    "build": "cd client && npm install && npm run build && cd .. && cd server && npm install",
    "start": "node server/index.js",
    "dev": "concurrently \"cd server && npm run dev\" \"cd client && npm run dev\"",
    "server": "cd server && npm run dev",
    "client": "cd client && npm run dev"
  }
}
```

**Updated Scripts**:
```json
{
  "scripts": {
    "build": "cd client && npm install && npm run build",
    "start": "cd client && npx serve -s dist -l 3000",
    "dev": "concurrently \"cd rotc_backend && python manage.py runserver\" \"cd client && npm run dev\"",
    "backend": "cd rotc_backend && python manage.py runserver",
    "client": "cd client && npm run dev",
    "migrate": "cd rotc_backend && python manage.py migrate",
    "test": "cd rotc_backend && pytest"
  }
}
```

**Key Changes**:
- Removed server build from build script
- Updated start script to serve frontend static files
- Updated dev script to run Django backend
- Added backend script for Django development server
- Added migrate and test scripts for Django

### 2. Environment Variable Configuration

#### 2.1 Required Environment Variables

**Django Web Service**:
```bash
# Core Django Settings
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<generate-with-django-secret-key-generator>
DEBUG=false
PYTHON_VERSION=3.11.0

# Host Configuration
RENDER_EXTERNAL_HOSTNAME=rotc-django-web.onrender.com
ALLOWED_HOSTS=rotc-django-web.onrender.com,msu-snd-rgms-1.onrender.com
CORS_ALLOWED_ORIGINS=https://msu-snd-rgms-1.onrender.com,https://rotc-grading.com

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis Configuration
REDIS_URL=redis://default:password@host:6379

# Celery Configuration
CELERY_BROKER_URL=redis://default:password@host:6379
CELERY_RESULT_BACKEND=redis://default:password@host:6379

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional: Sentry Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
ENVIRONMENT=production
RELEASE_VERSION=1.0.0
```

**Django Channels Service**:
```bash
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<same-as-web-service>
DEBUG=false
PYTHON_VERSION=3.11.0
RENDER_EXTERNAL_HOSTNAME=rotc-django-channels.onrender.com
ALLOWED_HOSTS=rotc-django-channels.onrender.com
DATABASE_URL=<same-as-web-service>
REDIS_URL=<same-as-web-service>
```

**Celery Worker Service**:
```bash
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<same-as-web-service>
DEBUG=false
PYTHON_VERSION=3.11.0
DATABASE_URL=<same-as-web-service>
REDIS_URL=<same-as-web-service>
CELERY_BROKER_URL=<same-as-web-service>
CELERY_RESULT_BACKEND=<same-as-web-service>
CLOUDINARY_CLOUD_NAME=<same-as-web-service>
CLOUDINARY_API_KEY=<same-as-web-service>
CLOUDINARY_API_SECRET=<same-as-web-service>
```

**Celery Beat Service**:
```bash
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<same-as-web-service>
DEBUG=false
PYTHON_VERSION=3.11.0
DATABASE_URL=<same-as-web-service>
REDIS_URL=<same-as-web-service>
CELERY_BROKER_URL=<same-as-web-service>
CELERY_RESULT_BACKEND=<same-as-web-service>
```

#### 2.2 Environment Variable Generation

**SECRET_KEY Generation**:
```python
# Generate Django secret key
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

**ALLOWED_HOSTS Configuration**:
```python
# In production.py
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')
# Set in Render: rotc-django-web.onrender.com,custom-domain.com
```

**CORS_ALLOWED_ORIGINS Configuration**:
```python
# In production.py
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
# Set in Render: https://frontend-domain.com,https://custom-domain.com
```

### 3. Frontend API Configuration Updates

#### 3.1 Environment Variables

**Development** (`.env.development`):
```bash
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_ENV=development
```

**Production** (`.env.production`):
```bash
VITE_API_URL=https://rotc-django-web.onrender.com
VITE_WS_URL=wss://rotc-django-channels.onrender.com
VITE_ENV=production
```

#### 3.2 API Client Updates

**Updated API Client** (`client/src/utils/api.js`):
```javascript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // Handle Django error response format
      const { status, data } = error.response;
      
      if (status === 401) {
        // Unauthorized - redirect to login
        localStorage.removeItem('authT
oken');
        window.location.href = '/login';
      } else if (status === 403) {
        // Forbidden
        console.error('Access denied:', data.message);
      } else if (status >= 500) {
        // Server error
        console.error('Server error:', data.message);
      }
      
      // Return formatted error
      return Promise.reject({
        status,
        message: data.message || 'An error occurred',
        code: data.code,
        details: data.details,
      });
    } else if (error.request) {
      // Network error - backend unreachable
      return Promise.reject({
        status: 0,
        message: 'Unable to connect to server. Please check your internet connection.',
        code: 'NETWORK_ERROR',
      });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
export { WS_BASE_URL };
```

#### 3.3 WebSocket Client Updates

**Updated WebSocket Client** (`client/src/utils/websocket.js`):
```javascript
import { WS_BASE_URL } from './api';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect(endpoint, onMessage, onError) {
    const token = localStorage.getItem('authToken');
    const wsUrl = `${WS_BASE_URL}${endpoint}?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);

    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (onError) onError(error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect(endpoint, onMessage, onError);
    };
  }
  
  attemptReconnect(endpoint, onMessage, onError) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(endpoint, onMessage, onError);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
  
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new WebSocketClient();
```

### 4. Port Binding Fix (CRITICAL)

**Problem**: Django services are not binding to the PORT environment variable provided by Render, causing deployment failure.

**Solution**: Update Gunicorn and Daphne configurations to bind to `0.0.0.0:$PORT`.


#### 4.1 Gunicorn Configuration Fix

**File**: `rotc_backend/gunicorn.conf.py`

```python
import os
import multiprocessing

# Bind to 0.0.0.0 and PORT environment variable (required for Render)
port = os.environ.get('PORT', '8000')
bind = f"0.0.0.0:{port}"

# Worker configuration
workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = 'sync'
worker_connections = 1000
timeout = 120
keepalive = 5

# Performance tuning
max_requests = 1000
max_requests_jitter = 50
preload_app = True

# Logging
accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info')

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
```

**Key Changes**:
- `bind = f"0.0.0.0:{port}"` - Binds to all interfaces on the PORT env var
- Dynamic port from environment variable
- Defaults to 8000 for local development


#### 4.2 Daphne Configuration Fix

**File**: `rotc_backend/daphne.conf.py`

```python
import os

# Bind to 0.0.0.0 and PORT environment variable (required for Render)
port = os.environ.get('PORT', '8001')
bind = '0.0.0.0'

# Application
application = 'config.asgi:application'

# Logging
verbosity = 1
access_log = '-'

# WebSocket settings
websocket_timeout = 86400  # 24 hours
websocket_connect_timeout = 5
ping_interval = 20
ping_timeout = 30
```

**Alternative: Command-line approach** (if config file not supported):

Update `render.yaml` start command:
```yaml
startCommand: daphne -b 0.0.0.0 -p $PORT config.asgi:application --verbosity 1 --access-log -
```

**Key Changes**:
- Explicit binding to `0.0.0.0` (all interfaces)
- Port from `$PORT` environment variable
- Defaults to 8001 for local development

#### 4.3 Verification

After deployment, verify port binding:
```bash
# Check if service is listening on correct port
curl https://rotc-django-web.onrender.com/api/health

# Expected response:
# {"status": "healthy", "timestamp": "...", "services": {...}}
```


### 5. Data Migration Implementation

#### 5.1 Export Script

**File**: `rotc_backend/scripts/export_nodejs_data.py`

```python
import os
import json
import psycopg2
from datetime import datetime
from pathlib import Path

# Node.js database connection
NODEJS_DB_URL = os.environ.get('NODEJS_DATABASE_URL')

# Export directory
EXPORT_DIR = Path(__file__).parent / 'migration_data'
EXPORT_DIR.mkdir(exist_ok=True)

# Tables to export (in dependency order)
TABLES = [
    'users', 'cadets', 'staff', 'grade_categories', 'activities',
    'attendance', 'grades', 'files', 'reports', 'messages',
    'notifications', 'audit_logs', 'settings'
]

def export_table(cursor, table_name):
    """Export a single table to JSON"""
    cursor.execute(f"SELECT * FROM {table_name}")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    data = []
    for row in rows:
        record = {}
        for i, col in enumerate(columns):
            value = row[i]
            # Handle datetime serialization
            if isinstance(value, datetime):
                value = value.isoformat()
            record[col] = value
        data.append(record)
    
    # Write to JSON file
    output_file = EXPORT_DIR / f"{table_name}.json"
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2, default=str)
    
    print(f"Exported {len(data)} records from {table_name}")
    return len(data)


def main():
    """Main export function"""
    conn = psycopg2.connect(NODEJS_DB_URL)
    cursor = conn.cursor()
    
    manifest = {
        'export_date': datetime.utcnow().isoformat(),
        'tables': {}
    }
    
    for table in TABLES:
        try:
            count = export_table(cursor, table)
            manifest['tables'][table] = count
        except Exception as e:
            print(f"Error exporting {table}: {e}")
            manifest['tables'][table] = {'error': str(e)}
    
    # Write manifest
    with open(EXPORT_DIR / 'manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    
    cursor.close()
    conn.close()
    print(f"\nExport complete. Data saved to {EXPORT_DIR}")

if __name__ == '__main__':
    main()
```

#### 5.2 Import Script

**File**: `rotc_backend/scripts/import_django_data.py`

```python
import os
import json
import django
from pathlib import Path
from datetime import datetime

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
django.setup()

from django.contrib.auth import get_user_model
from apps.cadets.models import Cadet
from apps.staff.models import Staff
from apps.activities.models import Activity
from apps.attendance.models import Attendance
from apps.grading.models import Grade, GradeCategory
# ... import other models

User = get_user_model()
IMPORT_DIR = Path(__file__).parent / 'migration_data'


def import_users(data):
    """Import users with password hash preservation"""
    for record in data:
        User.objects.create(
            id=record['id'],
            username=record['username'],
            email=record['email'],
            password=f"bcrypt_sha256${record['password']}",  # Prefix for Django
            first_name=record.get('first_name', ''),
            last_name=record.get('last_name', ''),
            is_active=record.get('is_active', True),
            is_staff=record.get('is_staff', False),
            date_joined=record.get('created_at'),
        )
    print(f"Imported {len(data)} users")

def import_table(model_class, data, field_mapping=None):
    """Generic table import with field mapping"""
    for record in data:
        if field_mapping:
            record = {field_mapping.get(k, k): v for k, v in record.items()}
        model_class.objects.create(**record)
    print(f"Imported {len(data)} {model_class.__name__} records")

def main():
    """Main import function"""
    # Import in dependency order
    with open(IMPORT_DIR / 'users.json') as f:
        import_users(json.load(f))
    
    with open(IMPORT_DIR / 'cadets.json') as f:
        import_table(Cadet, json.load(f))
    
    # ... import other tables
    
    print("\nImport complete")

if __name__ == '__main__':
    main()
```


#### 5.3 Verification Script

**File**: `rotc_backend/scripts/verify_migration.py`

```python
import os
import django
import psycopg2
from collections import defaultdict

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
django.setup()

from django.contrib.auth import get_user_model
from apps.cadets.models import Cadet
# ... import other models

User = get_user_model()
NODEJS_DB_URL = os.environ.get('NODEJS_DATABASE_URL')

def verify_counts():
    """Verify record counts match"""
    conn = psycopg2.connect(NODEJS_DB_URL)
    cursor = conn.cursor()
    
    models = [
        ('users', User),
        ('cadets', Cadet),
        # ... other models
    ]
    
    report = []
    for table_name, model_class in models:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        nodejs_count = cursor.fetchone()[0]
        django_count = model_class.objects.count()
        
        match = '✓' if nodejs_count == django_count else '✗'
        report.append(f"{match} {table_name}: Node.js={nodejs_count}, Django={django_count}")
    
    cursor.close()
    conn.close()
    
    return '\n'.join(report)

def verify_relationships():
    """Verify foreign key integrity"""
    # Check for orphaned records
    orphaned = []
    
    # Example: Check cadets have valid user_id
    for cadet in Cadet.objects.all():
        if not User.objects.filter(id=cadet.user_id).exists():
            orphaned.append(f"Cadet {cadet.id} has invalid user_id {cadet.user_id}")
    
    return orphaned

def main():
    print("=== Migration Verification Report ===\n")
    print("Record Counts:")
    print(verify_counts())
    print("\nRelationship Integrity:")
    orphaned = verify_relationships()
    if orphaned:
        print("✗ Found orphaned records:")
        for item in orphaned:
            print(f"  - {item}")
    else:
        print("✓ All relationships intact")

if __name__ == '__main__':
    main()
```


### 6. Rollback Architecture

#### 6.1 Rollback Procedure

**Trigger Conditions**:
- Error rate > 5% for 5 consecutive minutes
- 95th percentile response time > 1 second for 10 minutes
- Critical feature failure (authentication, grading, file upload)
- Database corruption detected

**Rollback Steps** (Target: < 15 minutes):

1. **Revert Render Services** (5 minutes):
   ```bash
   # In Render dashboard:
   # 1. Navigate to rotc-django-web service
   # 2. Click "Manual Deploy" → "Deploy previous version"
   # 3. Select the last Node.js deployment
   # 4. Repeat for all services
   ```

2. **Update Frontend Configuration** (3 minutes):
   ```bash
   # Update .env.production
   VITE_API_URL=https://msu-snd-rgms-1.onrender.com
   VITE_WS_URL=wss://msu-snd-rgms-1.onrender.com
   
   # Rebuild and deploy frontend
   npm run build
   # Deploy to hosting
   ```

3. **Verify Node.js Backend** (2 minutes):
   ```bash
   # Check health endpoint
   curl https://msu-snd-rgms-1.onrender.com/health
   
   # Verify database connection
   # Test authentication
   # Test critical features
   ```

4. **Preserve Django State** (5 minutes):
   ```bash
   # Create Django database dump
   pg_dump $DJANGO_DATABASE_URL > django_state_$(date +%Y%m%d_%H%M%S).sql
   
   # Export logs
   # Document issues encountered
   ```

#### 6.2 Rollback Decision Matrix

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | > 5% for 5 min | Investigate, prepare rollback |
| Error Rate | > 10% for 2 min | Execute rollback immediately |
| Response Time (p95) | > 1s for 10 min | Investigate, prepare rollback |
| Response Time (p95) | > 2s for 5 min | Execute rollback immediately |
| Auth Failure Rate | > 1% | Execute rollback immediately |
| Data Corruption | Any instance | Execute rollback immediately |


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. I performed a reflection to eliminate redundancy:

**Redundancy Analysis**:
- Properties 4.4, 10.2 (foreign key preservation) → Combined into Property 1
- Properties 4.5, 10.5 (timestamp preservation) → Combined into Property 2
- Properties 4.6, 10.3 (password preservation) → Combined into Property 3
- Properties 4.7, 10.4 (file URL preservation) → Combined into Property 4
- Properties 10.1 (record counts) → Standalone Property 5
- Properties 10.6 (boolean values) → Combined with Property 6 (data type handling)
- Properties 10.7 (m2m relationships) → Part of Property 1 (relationships)
- Properties 10.8 (unique constraints) → Standalone Property 7
- Properties 10.10 (round-trip serialization) → Standalone Property 8
- Properties 3.3-3.7 (frontend data handling) → Combined into Properties 9-11
- Properties 6.2-6.7 (backend functionality) → Combined into Properties 12-15

### Property 1: Relationship Preservation

For any record with foreign key or many-to-many relationships in the source database, after migration those relationships must be intact in the destination database with no orphaned records.

**Validates: Requirements 4.4, 10.2, 10.7**

### Property 2: Timestamp Preservation

For any record with timestamp fields (created_at, updated_at) in the source database, after migration those timestamps must be preserved in UTC timezone and match the source values.

**Validates: Requirements 4.5, 10.5**


### Property 3: Password Authentication Preservation

For any user account in the source database, after migration that user must be able to authenticate with their original password using the Django backend.

**Validates: Requirements 4.6, 10.3**

### Property 4: File URL Accessibility

For any file record with a Cloudinary URL in the source database, after migration that URL must be preserved and accessible (returns HTTP 200).

**Validates: Requirements 4.7, 10.4**

### Property 5: Record Count Preservation

For any database model, the record count in the destination database must equal the record count in the source database.

**Validates: Requirements 10.1**

### Property 6: Data Type Correctness

For any record field, the data type in the destination database must correctly represent the source data (booleans as true/false, integers as numbers, strings as text, etc.).

**Validates: Requirements 3.5, 10.6**

### Property 7: Unique Constraint Enforcement

For any model with unique constraints, attempting to create a duplicate record must fail with a constraint violation error.

**Validates: Requirements 10.8**

### Property 8: Round-Trip Serialization

For any data object, serializing to JSON via the API and deserializing back to a database object must produce an equivalent object.

**Validates: Requirements 10.10**


### Property 9: JWT Token Inclusion

For any authenticated API request, the frontend must include the JWT token in the Authorization header with Bearer scheme.

**Validates: Requirements 3.3**

### Property 10: Datetime Parsing

For any API response containing ISO 8601 datetime strings, the frontend must correctly parse them into JavaScript Date objects.

**Validates: Requirements 3.4**

### Property 11: Paginated Response Handling

For any paginated API response, the frontend must correctly extract the page, limit, total, and data fields.

**Validates: Requirements 3.6**

### Property 12: Error Response Standardization

For any error condition in the Django backend, the response must include error, message, code, and details fields with appropriate HTTP status codes.

**Validates: Requirements 3.7, 6.9**

### Property 13: User Authentication

For any valid user credentials, the Django backend must successfully authenticate and return a JWT token.

**Validates: Requirements 6.2**

### Property 14: CRUD Operations

For any of the 19 database models and any valid data, the Django backend must successfully handle Create, Read, Update, and Delete operations.

**Validates: Requirements 6.3**

### Property 15: File Upload Success

For any valid file (image or document), the Django backend must successfully upload to Cloudinary and return a valid accessible URL.

**Validates: Requirements 6.4**


### Property 16: Background Task Execution

For any queued Celery task, the task must execute successfully and update the result backend with completion status.

**Validates: Requirements 6.5**

### Property 17: Redis Cache Round-Trip

For any cacheable data, storing in Redis and retrieving must return the same data.

**Validates: Requirements 6.7**

## Error Handling

### 1. Deployment Errors

**Missing Environment Variables**:
```python
# In config/settings/production.py
import os
from django.core.exceptions import ImproperlyConfigured

def get_env_variable(var_name, default=None):
    """Get environment variable or raise exception"""
    try:
        value = os.environ[var_name]
        if not value and default is None:
            raise ImproperlyConfigured(f"Set the {var_name} environment variable")
        return value or default
    except KeyError:
        if default is not None:
            return default
        raise ImproperlyConfigured(f"Set the {var_name} environment variable")

# Usage
SECRET_KEY = get_env_variable('SECRET_KEY')
DATABASE_URL = get_env_variable('DATABASE_URL')
```

**Port Binding Failure**:
```python
# Gunicorn will log:
# [ERROR] Connection in use: ('0.0.0.0', 10000)
# Solution: Ensure PORT env var is set and unique per service
```

**Database Connection Failure**:
```python
# Django will raise:
# django.db.utils.OperationalError: could not connect to server
# Solution: Verify DATABASE_URL format and database accessibility
```


### 2. Migration Errors

**Data Validation Failure**:
```python
# Export validation
def validate_export(manifest):
    """Validate exported data completeness"""
    required_tables = ['users', 'cadets', 'staff', ...]
    missing = [t for t in required_tables if t not in manifest['tables']]
    if missing:
        raise ValueError(f"Missing tables in export: {missing}")
    
    for table, count in manifest['tables'].items():
        if isinstance(count, dict) and 'error' in count:
            raise ValueError(f"Export error in {table}: {count['error']}")
        if count == 0:
            print(f"Warning: {table} has 0 records")
```

**Foreign Key Violation**:
```python
# During import
try:
    Cadet.objects.create(user_id=user_id, ...)
except IntegrityError as e:
    if 'foreign key constraint' in str(e):
        print(f"Error: User {user_id} does not exist")
        # Log and skip, or halt import
```

**Duplicate Key Violation**:
```python
# During import
try:
    User.objects.create(id=record['id'], ...)
except IntegrityError as e:
    if 'duplicate key' in str(e):
        print(f"Warning: User {record['id']} already exists, skipping")
```

### 3. Runtime Errors

**Authentication Failure**:
```python
# In views
from rest_framework.exceptions import AuthenticationFailed

def authenticate_user(request):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        raise AuthenticationFailed('No authentication token provided')
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        return User.objects.get(id=payload['user_id'])
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed('Token has expired')
    except jwt.InvalidTokenError:
        raise AuthenticationFailed('Invalid token')
    except User.DoesNotExist:
        raise AuthenticationFailed('User not found')
```


**File Upload Failure**:
```python
# In file upload view
from cloudinary.exceptions import Error as CloudinaryError

def upload_file(file):
    try:
        result = cloudinary.uploader.upload(file)
        return result['secure_url']
    except CloudinaryError as e:
        raise APIException(f'File upload failed: {str(e)}')
    except Exception as e:
        raise APIException(f'Unexpected error during upload: {str(e)}')
```

**Celery Task Failure**:
```python
# In tasks
from celery.exceptions import Retry

@shared_task(bind=True, max_retries=3)
def process_report(self, report_id):
    try:
        report = Report.objects.get(id=report_id)
        # Process report
        report.status = 'completed'
        report.save()
    except Report.DoesNotExist:
        # Don't retry if report doesn't exist
        raise
    except Exception as e:
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
```

**Redis Connection Failure**:
```python
# In cache operations
from django.core.cache import cache
from redis.exceptions import ConnectionError

def get_cached_data(key):
    try:
        return cache.get(key)
    except ConnectionError:
        # Fallback to database if Redis unavailable
        print("Warning: Redis unavailable, falling back to database")
        return None
```

### 4. Frontend Error Handling

**Network Errors**:
```javascript
// In API client
try {
  const response = await apiClient.get('/endpoint');
  return response.data;
} catch (error) {
  if (error.status === 0) {
    // Network error
    showNotification('Unable to connect to server', 'error');
  } else if (error.status === 401) {
    // Unauthorized
    redirectToLogin();
  } else if (error.status >= 500) {
    // Server error
    showNotification('Server error, please try again later', 'error');
  } else {
    // Other errors
    showNotification(error.message, 'error');
  }
}
```


## Testing Strategy

### Dual Testing Approach

This migration requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library Selection**: 
- Python: `hypothesis` (industry-standard PBT library for Python)
- JavaScript: `fast-check` (for frontend tests)

**Configuration**:
```python
# In pytest.ini or conftest.py
from hypothesis import settings, Verbosity

# Configure hypothesis
settings.register_profile("default", max_examples=100, verbosity=Verbosity.normal)
settings.register_profile("ci", max_examples=200, verbosity=Verbosity.verbose)
settings.load_profile("default")
```

**Test Tagging**:
Each property test must reference its design document property:
```python
import pytest
from hypothesis import given
from hypothesis import strategies as st

@pytest.mark.property_test
def test_relationship_preservation():
    """
    Feature: django-backend-activation, Property 1: Relationship Preservation
    
    For any record with foreign key or many-to-many relationships in the source 
    database, after migration those relationships must be intact in the destination 
    database with no orphaned records.
    """
    # Test implementation
    pass
```

### Test Categories

#### 1. Migration Tests

**Property Tests**:
```python
@given(st.builds(User))
def test_property_1_relationship_preservation(user):
    """Property 1: Relationship preservation"""
    # Create user with related cadet
    cadet = Cadet.objects.create(user=user, ...)
    
    # Verify relationship
    assert cadet.user_id == user.id
    assert user.cadet == cadet
```


```python
@given(st.datetimes(timezones=st.just(timezone.utc)))
def test_property_2_timestamp_preservation(timestamp):
    """Property 2: Timestamp preservation"""
    # Create record with timestamp
    user = User.objects.create(date_joined=timestamp)
    
    # Verify timestamp preserved in UTC
    assert user.date_joined.tzinfo == timezone.utc
    assert user.date_joined == timestamp

@given(st.text(min_size=8, max_size=100))
def test_property_3_password_authentication(password):
    """Property 3: Password authentication preservation"""
    # Create user with password
    user = User.objects.create_user(username='test', password=password)
    
    # Verify authentication works
    assert user.check_password(password)

@given(st.integers(min_value=1, max_value=1000))
def test_property_5_record_count_preservation(count):
    """Property 5: Record count preservation"""
    # Create N users
    users = [User.objects.create(username=f'user{i}') for i in range(count)]
    
    # Verify count
    assert User.objects.count() == count

@given(st.booleans(), st.integers(), st.text())
def test_property_6_data_type_correctness(bool_val, int_val, str_val):
    """Property 6: Data type correctness"""
    # Create record with various types
    cadet = Cadet.objects.create(
        is_active=bool_val,
        year=int_val,
        notes=str_val
    )
    
    # Verify types preserved
    assert isinstance(cadet.is_active, bool)
    assert isinstance(cadet.year, int)
    assert isinstance(cadet.notes, str)
```

**Unit Tests**:
```python
def test_export_script_creates_files():
    """Verify export script creates JSON files"""
    # Run export
    export_nodejs_data.main()
    
    # Verify files exist
    assert (EXPORT_DIR / 'users.json').exists()
    assert (EXPORT_DIR / 'cadets.json').exists()
    assert (EXPORT_DIR / 'manifest.json').exists()

def test_import_handles_missing_foreign_key():
    """Verify import handles missing foreign key gracefully"""
    # Attempt to import cadet with non-existent user_id
    with pytest.raises(IntegrityError):
        Cadet.objects.create(user_id=99999, ...)
```


#### 2. Backend Functionality Tests

**Property Tests**:
```python
@given(st.builds(User), st.text(min_size=8))
def test_property_13_user_authentication(user, password):
    """Property 13: User authentication"""
    # Set password
    user.set_password(password)
    user.save()
    
    # Authenticate
    from django.contrib.auth import authenticate
    authenticated_user = authenticate(username=user.username, password=password)
    
    assert authenticated_user is not None
    assert authenticated_user.id == user.id

@given(st.sampled_from([User, Cadet, Staff, Activity, Grade]))
def test_property_14_crud_operations(model_class):
    """Property 14: CRUD operations"""
    # Create
    instance = model_class.objects.create(...)
    assert instance.id is not None
    
    # Read
    retrieved = model_class.objects.get(id=instance.id)
    assert retrieved == instance
    
    # Update
    instance.save()
    
    # Delete
    instance.delete()
    assert not model_class.objects.filter(id=instance.id).exists()

@given(st.binary(min_size=100, max_size=1024*1024))
def test_property_15_file_upload(file_data):
    """Property 15: File upload success"""
    # Create file
    from django.core.files.uploadedfile import SimpleUploadedFile
    file = SimpleUploadedFile("test.jpg", file_data, content_type="image/jpeg")
    
    # Upload
    result = upload_to_cloudinary(file)
    
    # Verify URL is valid and accessible
    assert result.startswith('https://')
    response = requests.head(result)
    assert response.status_code == 200
```


```python
@given(st.text(), st.binary())
def test_property_17_redis_cache_roundtrip(key, value):
    """Property 17: Redis cache round-trip"""
    # Store in cache
    cache.set(key, value, timeout=60)
    
    # Retrieve from cache
    retrieved = cache.get(key)
    
    # Verify same value
    assert retrieved == value

@given(st.sampled_from(['ValidationError', 'NotFound', 'PermissionDenied']))
def test_property_12_error_response_standardization(error_type):
    """Property 12: Error response standardization"""
    # Trigger error
    response = trigger_error(error_type)
    
    # Verify response format
    assert 'error' in response
    assert 'message' in response
    assert 'code' in response
    assert 'details' in response
    assert response.status_code in [400, 403, 404, 500]
```

**Unit Tests**:
```python
def test_health_check_endpoint():
    """Verify health check returns correct format"""
    response = client.get('/api/health')
    
    assert response.status_code == 200
    assert response.json()['status'] == 'healthy'
    assert 'database' in response.json()['services']
    assert 'redis' in response.json()['services']
    assert 'celery' in response.json()['services']

def test_websocket_connection():
    """Verify WebSocket connection establishes"""
    from channels.testing import WebsocketCommunicator
    
    communicator = WebsocketCommunicator(application, "/ws/notifications/")
    connected, _ = await communicator.connect()
    
    assert connected
    await communicator.disconnect()

def test_celery_task_execution():
    """Verify Celery task executes"""
    from apps.reports.tasks import generate_report
    
    result = generate_report.delay(report_id=1)
    assert result.get(timeout=10) == 'success'
```


#### 3. Frontend Integration Tests

**Property Tests** (using fast-check):
```javascript
import fc from 'fast-check';

test('Property 9: JWT token inclusion', () => {
  fc.assert(
    fc.property(fc.string(), async (token) => {
      // Feature: django-backend-activation, Property 9
      localStorage.setItem('authToken', token);
      
      const request = await apiClient.get('/test');
      
      // Verify Authorization header includes token
      expect(request.headers.Authorization).toBe(`Bearer ${token}`);
    })
  );
});

test('Property 10: Datetime parsing', () => {
  fc.assert(
    fc.property(fc.date(), (date) => {
      // Feature: django-backend-activation, Property 10
      const isoString = date.toISOString();
      
      // Parse ISO 8601 string
      const parsed = new Date(isoString);
      
      // Verify correct parsing
      expect(parsed.getTime()).toBe(date.getTime());
    })
  );
});

test('Property 11: Paginated response handling', () => {
  fc.assert(
    fc.property(
      fc.integer({min: 1, max: 100}),
      fc.integer({min: 1, max: 50}),
      fc.integer({min: 0, max: 1000}),
      fc.array(fc.anything()),
      (page, limit, total, data) => {
        // Feature: django-backend-activation, Property 11
        const response = { page, limit, total, data };
        
        // Extract fields
        const extracted = extractPaginationData(response);
        
        // Verify all fields present
        expect(extracted.page).toBe(page);
        expect(extracted.limit).toBe(limit);
        expect(extracted.total).toBe(total);
        expect(extracted.data).toEqual(data);
      }
    )
  );
});
```


**Unit Tests**:
```javascript
test('401 response redirects to login', async () => {
  // Mock 401 response
  mockAxios.onGet('/api/v1/test').reply(401);
  
  // Make request
  await expect(apiClient.get('/test')).rejects.toThrow();
  
  // Verify redirect
  expect(window.location.href).toBe('/login');
});

test('Network error shows user-friendly message', async () => {
  // Mock network error
  mockAxios.onGet('/api/v1/test').networkError();
  
  // Make request
  try {
    await apiClient.get('/test');
  } catch (error) {
    expect(error.message).toContain('Unable to connect to server');
  }
});

test('API uses correct prefix', () => {
  const endpoint = '/cadets';
  const fullUrl = apiClient.getUri({ url: endpoint });
  
  expect(fullUrl).toContain('/api/v1/cadets');
});
```

#### 4. Deployment Tests

**Unit Tests**:
```python
def test_port_binding():
    """Verify Gunicorn binds to PORT env var"""
    import os
    os.environ['PORT'] = '8000'
    
    from gunicorn.config import Config
    config = Config()
    config.set('config', 'gunicorn.conf.py')
    
    assert '0.0.0.0:8000' in config.bind

def test_environment_variables_required():
    """Verify required env vars are checked"""
    import os
    
    # Remove required env var
    if 'SECRET_KEY' in os.environ:
        del os.environ['SECRET_KEY']
    
    # Verify Django raises error
    with pytest.raises(ImproperlyConfigured):
        from config.settings.production import SECRET_KEY
```


```python
def test_render_yaml_valid():
    """Verify render.yaml is valid"""
    import yaml
    
    with open('render.yaml') as f:
        config = yaml.safe_load(f)
    
    # Verify structure
    assert 'services' in config
    assert len(config['services']) == 4
    
    # Verify service names
    service_names = [s['name'] for s in config['services']]
    assert 'rotc-django-web' in service_names
    assert 'rotc-django-channels' in service_names
    assert 'rotc-celery-worker' in service_names
    assert 'rotc-celery-beat' in service_names

def test_frontend_build_succeeds():
    """Verify frontend builds without Node backend"""
    import subprocess
    
    result = subprocess.run(['npm', 'run', 'build'], cwd='client', capture_output=True)
    
    assert result.returncode == 0
    assert (Path('client/dist/index.html')).exists()
```

### Test Execution

**Local Development**:
```bash
# Run all tests
cd rotc_backend
pytest

# Run only property tests
pytest -m property_test

# Run with coverage
pytest --cov=apps --cov-report=html

# Run frontend tests
cd client
npm test
```

**CI/CD Pipeline**:
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest --cov=apps --cov-report=xml
      - uses: codecov/codecov-action@v2
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd client && npm install && npm test
```

### Test Coverage Goals

- Unit test coverage: > 80%
- Property test coverage: All 17 properties implemented
- Integration test coverage: All critical user flows
- End-to-end test coverage: Authentication, CRUD, file upload, WebSocket

---

## Summary

This design document provides a comprehensive blueprint for migrating the ROTC Grading System from Node.js to Django. The key components include:

1. **Deployment Configuration**: Updated render.yaml with 4 Django services and proper port binding
2. **Environment Variables**: Complete configuration for all services
3. **Frontend Integration**: Updated API client with error handling and WebSocket support
4. **Port Binding Fix**: Critical fix for Gunicorn and Daphne to bind to 0.0.0.0:$PORT
5. **Data Migration**: Export, import, and verification scripts with relationship preservation
6. **Rollback Architecture**: 15-minute rollback procedure with decision matrix
7. **Correctness Properties**: 17 properties covering migration, backend, and frontend
8. **Error Handling**: Comprehensive error handling for all failure modes
9. **Testing Strategy**: Dual approach with unit tests and property-based tests using hypothesis

The migration is designed to be safe, reversible, and verifiable with comprehensive testing at every stage.
