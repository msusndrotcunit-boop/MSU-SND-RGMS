# Design Document: Render Deployment System Rebuild

## Overview

This document provides the comprehensive technical design for rebuilding and migrating the MSU-SND ROTC Grading Management System to align with Render's runtime and environment setup. The system is transitioning from a Node.js/Express backend to a Django/Python backend as the active production system, with proper configuration for Render's cloud platform.

The rebuild involves deploying four Django services (web, channels, celery worker, celery beat), migrating data from the legacy Node.js database, updating frontend integration, and establishing production-ready infrastructure with proper monitoring, caching, and background task processing.

### Migration Scope

- Deploy Django backend services to Render with proper port binding and environment configuration
- Configure PostgreSQL (NeonDB) and Redis for production use
- Update frontend API client to communicate with Django backend
- Migrate data from Node.js PostgreSQL to Django PostgreSQL with integrity verification
- Implement Cloudinary for media storage
- Configure WebSocket support via Django Channels
- Set up Celery for background task processing
- Establish monitoring, logging, and error tracking
- Remove legacy Node.js backend after successful migration

### Success Criteria

- All four Django services deployed and healthy on Render
- Frontend successfully communicates with Django backend
- 100% data migration with integrity verification
- All features functional with acceptable performance (95th percentile < 500ms)
- Zero data loss during migration
- Rollback capability tested and documented
- Production monitoring and alerting operational

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        FE[React Frontend<br/>Vite + React Router<br/>PWA Support]
        MOBILE[Mobile Apps<br/>Android Capacitor]
        DESKTOP[Desktop App<br/>Electron]
    end
    
    subgraph "Render.com Load Balancer"
        LB[HTTPS/WSS Load Balancer<br/>SSL Termination]
    end

    
    subgraph "Django Services on Render"
        WEB[Django Web Service<br/>Gunicorn WSGI<br/>4 workers<br/>Port: $PORT]
        CHAN[Django Channels Service<br/>Daphne ASGI<br/>WebSocket Support<br/>Port: $PORT]
        CELW[Celery Worker<br/>Background Tasks<br/>2 concurrency]
        CELB[Celery Beat<br/>Periodic Scheduler<br/>Cron Jobs]
    end
    
    subgraph "Data Layer"
        PG[(NeonDB PostgreSQL<br/>Serverless<br/>Primary Database)]
        REDIS[(Redis<br/>Upstash/Redis Labs<br/>Cache + Broker)]
        CLOUD[Cloudinary<br/>Media Storage<br/>Images/Documents]
    end
    
    FE -->|HTTPS API| LB
    FE -->|WSS WebSocket| LB
    MOBILE -->|HTTPS API| LB
    DESKTOP -->|HTTPS API| LB
    
    LB -->|/api/v1/*| WEB
    LB -->|/ws/*| CHAN
    
    WEB -->|Read/Write| PG
    WEB -->|Cache GET| REDIS
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

### Render Service Deployment Architecture

```mermaid
graph LR
    subgraph "Render.com Services"
        subgraph "Web Services - Starter Plan"
            W1[rotc-django-web<br/>Python 3.11<br/>Health: /api/health]
            W2[rotc-django-channels<br/>Python 3.11<br/>WebSocket]
        end
        
        subgraph "Worker Services - Starter Plan"
            WK1[rotc-celery-worker<br/>Python 3.11<br/>Task Processing]
            WK2[rotc-celery-beat<br/>Python 3.11<br/>Scheduler]
        end
    end
    
    subgraph "External Services"
        DB[(NeonDB PostgreSQL<br/>Serverless<br/>Auto-scaling)]
        RD[(Redis<br/>Upstash<br/>Persistent)]
        CL[Cloudinary<br/>CDN Storage]
        SENTRY[Sentry.io<br/>Error Tracking]
    end
    
    W1 --> DB
    W1 --> RD
    W1 --> CL
    W1 --> SENTRY
    
    W2 --> DB
    W2 --> RD
    
    WK1 --> DB
    WK1 --> RD
    WK1 --> CL
    WK1 --> SENTRY
    
    WK2 --> DB
    WK2 --> RD
    
    style W1 fill:#4CAF50
    style W2 fill:#2196F3
    style WK1 fill:#FF9800
    style WK2 fill:#9C27B0
```


### Data Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant LB as Load Balancer
    participant Django as Django Web
    participant Channels as Django Channels
    participant PostgreSQL
    participant Redis
    participant Celery
    participant Cloudinary
    
    User->>Frontend: Login Request
    Frontend->>LB: POST /api/v1/auth/login
    LB->>Django: Forward Request
    Django->>PostgreSQL: Verify Credentials
    PostgreSQL-->>Django: User Data
    Django->>Redis: Cache Session
    Django-->>LB: JWT Token
    LB-->>Frontend: JWT Token
    Frontend-->>User: Dashboard
    
    User->>Frontend: Upload File
    Frontend->>LB: POST /api/v1/files/upload
    LB->>Django: Forward Request
    Django->>Cloudinary: Upload File
    Cloudinary-->>Django: File URL
    Django->>PostgreSQL: Save File Record
    Django->>Redis: Queue Processing Task
    Django-->>LB: File Metadata
    LB-->>Frontend: File Metadata
    
    Redis->>Celery: Dequeue Task
    Celery->>PostgreSQL: Update Records
    Celery->>Channels: Notify via Redis Pub/Sub
    Channels->>Frontend: WebSocket Update
    Frontend-->>User: Real-time Notification
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
    DECISION -->|Yes| MONITOR[Monitor Production 24h]
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
- Django 5.0+
- Django REST Framework 3.14+
- Gunicorn WSGI server (4 workers)
- Python 3.11
- WhiteNoise for static file serving

**Port Binding Configuration**:
```python
# rotc_backend/gunicorn.conf.py
import os
import multiprocessing

# CRITICAL: Bind to 0.0.0.0 and PORT environment variable (required for Render)
port = os.environ.get('PORT', '8000')
bind = f"0.0.0.0:{port}"

# Worker configuration
workers = int(os.environ.get('GUNICORN_WORKERS', 4))
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
```


**API Endpoints**:
- `/api/v1/auth/*` - Authentication (login, logout, refresh, verify)
- `/api/v1/cadets/*` - Cadet management (CRUD operations)
- `/api/v1/staff/*` - Staff management
- `/api/v1/activities/*` - Activity management
- `/api/v1/attendance/*` - Attendance tracking
- `/api/v1/grading/*` - Grading operations
- `/api/v1/files/*` - File upload/download
- `/api/v1/reports/*` - Report generation (PDF)
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
  "version": "1.0.0",
  "environment": "production"
}
```

**Formal Specifications**:

**Preconditions**:
- `PORT` environment variable is set by Render
- `DATABASE_URL` is configured and database is accessible
- `REDIS_URL` is configured and Redis is accessible
- `SECRET_KEY` is set for JWT signing
- All required environment variables are present

**Postconditions**:
- Service binds to `0.0.0.0:$PORT` successfully
- Health check endpoint returns 200 OK
- All API endpoints are accessible
- Static files are served correctly
- JWT authentication works correctly

**Loop Invariants**: N/A (service runs continuously)

### 2. Django Channels Service (ASGI)

**Purpose**: WebSocket server for real-time bidirectional communication

**Technology Stack**:
- Django Channels 4.0+
- Daphne ASGI server
- Redis channel layer
- Python 3.11

**Port Binding Configuration**:
```python
# rotc_backend/daphne.conf.py
import os

# CRITICAL: Bind to 0.0.0.0 and PORT environment variable (required for Render)
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

**Alternative Start Command** (if config file not supported):
```bash
daphne -b 0.0.0.0 -p $PORT config.asgi:application --verbosity 1 --access-log -
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
    "priority": "high",
    "user_id": 123
  }
}
```

**Formal Specifications**:

**Preconditions**:
- `PORT` environment variable is set by Render
- `REDIS_URL` is configured for channel layer
- `DATABASE_URL` is configured
- WebSocket clients send valid JWT token in query parameter

**Postconditions**:
- Service binds to `0.0.0.0:$PORT` successfully
- WebSocket connections are established
- Messages are broadcast to connected clients
- Connections are maintained with ping/pong

**Loop Invariants**: 
- All active connections have valid authentication
- Message queue remains consistent during broadcast


### 3. Celery Worker Service

**Purpose**: Background task processing for asynchronous operations

**Technology Stack**:
- Celery 5.3+
- Redis broker
- Python 3.11

**Configuration**:
```python
# config/celery.py
import os
from celery import Celery

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')

app = Celery('rotc_backend')

# Configuration
app.config_from_object('django.conf:settings', namespace='CELERY')

# Celery settings
app.conf.update(
    broker_url=os.environ.get('REDIS_URL'),
    result_backend=os.environ.get('REDIS_URL'),
    accept_content=['json'],
    task_serializer='json',
    result_serializer='json',
    timezone='UTC',
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    worker_max_tasks_per_child=1000,
    worker_prefetch_multiplier=4,
    broker_connection_retry_on_startup=True,
)

# Auto-discover tasks
app.autodiscover_tasks()
```

**Task Types**:
- Email notifications (async)
- Report generation (PDF)
- Data export operations (CSV, Excel)
- File processing (OCR, compression, thumbnail generation)
- Batch operations (bulk grading, bulk attendance)
- Data synchronization
- Cleanup tasks (old sessions, expired tokens)

**Example Task**:
```python
# apps/reports/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from .models import Report

@shared_task(bind=True, max_retries=3)
def generate_attendance_report(self, report_id):
    """
    Generate attendance report PDF asynchronously
    
    Preconditions:
    - report_id exists in database
    - Report status is 'pending'
    
    Postconditions:
    - PDF file is generated and uploaded to Cloudinary
    - Report status is updated to 'completed'
    - User is notified via email
    """
    try:
        report = Report.objects.get(id=report_id)
        report.status = 'processing'
        report.save()
        
        # Generate PDF
        pdf_file = generate_pdf(report)
        
        # Upload to Cloudinary
        url = upload_to_cloudinary(pdf_file)
        
        # Update report
        report.file_url = url
        report.status = 'completed'
        report.save()
        
        # Send notification
        send_mail(
            'Report Ready',
            f'Your report is ready: {url}',
            'noreply@rotc.edu',
            [report.user.email],
        )
        
        return {'status': 'success', 'url': url}
    except Exception as exc:
        report.status = 'failed'
        report.save()
        raise self.retry(exc=exc, countdown=60)
```

**Formal Specifications**:

**Preconditions**:
- `REDIS_URL` is configured and Redis is accessible
- `DATABASE_URL` is configured
- Task queue is not full
- Required environment variables for external services (Cloudinary, email) are set

**Postconditions**:
- Tasks are consumed from Redis queue
- Task results are stored in Redis
- Database is updated with task results
- Errors are logged and retried according to retry policy

**Loop Invariants**:
- Worker maintains connection to Redis broker
- Task queue remains consistent during processing
- Failed tasks are retried up to max_retries


### 4. Celery Beat Service

**Purpose**: Periodic task scheduler for recurring operations

**Technology Stack**:
- Celery Beat 5.3+
- Redis broker
- Python 3.11

**Scheduled Tasks Configuration**:
```python
# config/settings/production.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'cleanup-old-sessions': {
        'task': 'apps.authentication.tasks.cleanup_sessions',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM UTC
    },
    'generate-daily-reports': {
        'task': 'apps.reports.tasks.generate_daily_reports',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6 AM UTC
    },
    'sync-attendance': {
        'task': 'apps.attendance.tasks.sync_attendance',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'cleanup-expired-tokens': {
        'task': 'apps.authentication.tasks.cleanup_expired_tokens',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM UTC
    },
    'backup-database': {
        'task': 'apps.system.tasks.backup_database',
        'schedule': crontab(hour=4, minute=0, day_of_week=0),  # Weekly on Sunday at 4 AM UTC
    },
}
```

**Formal Specifications**:

**Preconditions**:
- `REDIS_URL` is configured and Redis is accessible
- `DATABASE_URL` is configured
- Only one Celery Beat instance is running (to avoid duplicate task scheduling)
- System clock is synchronized (UTC)

**Postconditions**:
- Tasks are scheduled according to crontab expressions
- Tasks are queued to Redis at scheduled times
- Schedule state is persisted in database
- Missed tasks are not executed retroactively

**Loop Invariants**:
- Beat maintains connection to Redis broker
- Schedule remains consistent across restarts
- No duplicate task scheduling occurs

### 5. Frontend API Client

**Purpose**: HTTP client for communicating with Django backend

**Technology Stack**:
- Axios HTTP client
- React Query for caching
- JWT token management
- Vite environment variables

**Configuration**:
```javascript
// client/src/utils/api.js
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
      const { status, data } = error.response;
      
      if (status === 401) {
        // Unauthorized - redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      } else if (status === 403) {
        // Forbidden
        console.error('Access denied:', data.message);
      } else if (status >= 500) {
        // Server error
        console.error('Server error:', data.message);
      }
      
      return Promise.reject({
        status,
        message: data.message || 'An error occurred',
        code: data.code,
        details: data.details,
      });
    } else if (error.request) {
      // Network error
      return Promise.reject({
        status: 0,
        message: 'Unable to connect to server',
        code: 'NETWORK_ERROR',
      });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
export { WS_BASE_URL };
```

**Environment Variables**:

Development (`.env.development`):
```bash
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_ENV=development
```

Production (`.env.production`):
```bash
VITE_API_URL=https://rotc-django-web.onrender.com
VITE_WS_URL=wss://rotc-django-channels.onrender.com
VITE_ENV=production
```


### 6. Database Migration System

**Purpose**: Transfer data from Node.js to Django database with integrity verification

**Components**:

#### 6.1 Export Script

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
    """
    Export a single table to JSON
    
    Preconditions:
    - cursor is connected to Node.js database
    - table_name exists in database
    
    Postconditions:
    - JSON file created in EXPORT_DIR
    - All rows exported with proper serialization
    - Datetime values converted to ISO 8601 format
    """
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
        json.dump(data, f, indent=2)
    
    return len(data)

def export_all():
    """
    Export all tables from Node.js database
    
    Preconditions:
    - NODEJS_DB_URL is set
    - Node.js database is accessible
    
    Postconditions:
    - All tables exported to JSON files
    - Manifest file created with export metadata
    - Export summary logged
    """
    conn = psycopg2.connect(NODEJS_DB_URL)
    cursor = conn.cursor()
    
    manifest = {
        'export_date': datetime.utcnow().isoformat(),
        'tables': {}
    }
    
    for table in TABLES:
        count = export_table(cursor, table)
        manifest['tables'][table] = count
        print(f"Exported {count} records from {table}")
    
    # Write manifest
    with open(EXPORT_DIR / 'manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    
    cursor.close()
    conn.close()
    
    return manifest

if __name__ == '__main__':
    manifest = export_all()
    print(f"Export complete: {sum(manifest['tables'].values())} total records")
```

#### 6.2 Import Script

**File**: `rotc_backend/scripts/import_django_data.py`

```python
import os
import json
from pathlib import Path
from django.db import transaction
from apps.authentication.models import User
from apps.cadets.models import Cadet
from apps.staff.models import Staff
# ... import all models

EXPORT_DIR = Path(__file__).parent / 'migration_data'

def import_table(model_class, json_file, field_mapping):
    """
    Import data from JSON file to Django model
    
    Preconditions:
    - json_file exists and contains valid JSON
    - model_class is a valid Django model
    - field_mapping maps Node.js fields to Django fields
    
    Postconditions:
    - All records imported to Django database
    - Foreign key relationships preserved
    - Timestamps converted to UTC
    - Password hashes prefixed with bcrypt_sha256$
    """
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    imported = 0
    for record in data:
        # Map fields
        django_record = {}
        for node_field, django_field in field_mapping.items():
            if node_field in record:
                django_record[django_field] = record[node_field]
        
        # Create or update
        obj, created = model_class.objects.update_or_create(
            id=django_record['id'],
            defaults=django_record
        )
        imported += 1
    
    return imported

@transaction.atomic
def import_all():
    """
    Import all data from JSON files to Django database
    
    Preconditions:
    - Export manifest exists
    - All JSON files exist
    - Django database is empty or ready for import
    
    Postconditions:
    - All data imported successfully
    - Foreign key integrity maintained
    - Import summary logged
    """
    # Import in dependency order
    results = {}
    
    # Users first (no dependencies)
    results['users'] = import_table(
        User,
        EXPORT_DIR / 'users.json',
        {'id': 'id', 'username': 'username', 'email': 'email', ...}
    )
    
    # Then dependent tables
    # ... import other tables
    
    return results

if __name__ == '__main__':
    results = import_all()
    print(f"Import complete: {sum(results.values())} total records")
```


#### 6.3 Verification Script

**File**: `rotc_backend/scripts/verify_migration.py`

```python
import psycopg2
from django.db import connection

def verify_record_counts(nodejs_db_url):
    """
    Verify record counts match between Node.js and Django databases
    
    Preconditions:
    - nodejs_db_url is valid
    - Both databases are accessible
    
    Postconditions:
    - Returns dict with count comparison for each table
    - Logs discrepancies
    """
    nodejs_conn = psycopg2.connect(nodejs_db_url)
    nodejs_cursor = nodejs_conn.cursor()
    
    django_cursor = connection.cursor()
    
    tables = ['users', 'cadets', 'staff', 'activities', ...]
    results = {}
    
    for table in tables:
        # Node.js count
        nodejs_cursor.execute(f"SELECT COUNT(*) FROM {table}")
        nodejs_count = nodejs_cursor.fetchone()[0]
        
        # Django count (map to Django table name)
        django_table = f"authentication_user" if table == 'users' else f"app_{table}"
        django_cursor.execute(f"SELECT COUNT(*) FROM {django_table}")
        django_count = django_cursor.fetchone()[0]
        
        results[table] = {
            'nodejs': nodejs_count,
            'django': django_count,
            'match': nodejs_count == django_count
        }
    
    nodejs_cursor.close()
    nodejs_conn.close()
    
    return results

def verify_foreign_keys():
    """
    Verify foreign key integrity in Django database
    
    Preconditions:
    - Django database has data imported
    
    Postconditions:
    - Returns list of orphaned records (if any)
    - All foreign keys are valid
    """
    from apps.cadets.models import Cadet
    from apps.attendance.models import Attendance
    
    orphaned = []
    
    # Check cadet foreign keys
    for attendance in Attendance.objects.all():
        if not Cadet.objects.filter(id=attendance.cadet_id).exists():
            orphaned.append({
                'model': 'Attendance',
                'id': attendance.id,
                'missing_fk': 'cadet_id',
                'value': attendance.cadet_id
            })
    
    return orphaned

if __name__ == '__main__':
    counts = verify_record_counts(os.environ.get('NODEJS_DATABASE_URL'))
    orphaned = verify_foreign_keys()
    
    print("Record Count Verification:")
    for table, result in counts.items():
        status = "✓" if result['match'] else "✗"
        print(f"{status} {table}: Node.js={result['nodejs']}, Django={result['django']}")
    
    if orphaned:
        print(f"\n✗ Found {len(orphaned)} orphaned records")
    else:
        print("\n✓ No orphaned records found")
```

## Data Models

### Database Schema Mapping

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


## Algorithmic Pseudocode

### Main Deployment Algorithm

```pascal
ALGORITHM deployDjangoToRender(config)
INPUT: config containing environment variables, service definitions
OUTPUT: deploymentResult with status and service URLs

BEGIN
  ASSERT config.DATABASE_URL is valid
  ASSERT config.REDIS_URL is valid
  ASSERT config.SECRET_KEY is set
  
  // Step 1: Backup existing data
  backupResult ← createDatabaseBackup(config.NODEJS_DATABASE_URL)
  ASSERT backupResult.success = true
  
  // Step 2: Export Node.js data
  exportResult ← exportNodeJSData(config.NODEJS_DATABASE_URL)
  ASSERT exportResult.recordCount > 0
  
  // Step 3: Validate export
  validationResult ← validateExport(exportResult.manifest)
  IF NOT validationResult.valid THEN
    RETURN {status: "failed", error: "Export validation failed"}
  END IF
  
  // Step 4: Deploy Django services
  services ← ["web", "channels", "celery-worker", "celery-beat"]
  deployedServices ← []
  
  FOR each service IN services DO
    ASSERT service.config.PORT is bound to "0.0.0.0:$PORT"
    
    deployResult ← deployService(service, config)
    IF deployResult.status ≠ "live" THEN
      RETURN {status: "failed", error: "Service deployment failed", service: service}
    END IF
    
    deployedServices.add(deployResult)
  END FOR
  
  // Step 5: Import data to Django database
  importResult ← importDjangoData(exportResult.manifest, config.DATABASE_URL)
  ASSERT importResult.recordCount = exportResult.recordCount
  
  // Step 6: Verify data integrity
  verificationResult ← verifyDataIntegrity(config.NODEJS_DATABASE_URL, config.DATABASE_URL)
  IF NOT verificationResult.allMatch THEN
    RETURN {status: "failed", error: "Data integrity check failed"}
  END IF
  
  // Step 7: Update frontend configuration
  frontendResult ← updateFrontendConfig(deployedServices)
  ASSERT frontendResult.success = true
  
  // Step 8: Run integration tests
  testResult ← runIntegrationTests(deployedServices)
  IF testResult.passRate < 0.95 THEN
    RETURN {status: "failed", error: "Integration tests failed"}
  END IF
  
  // Step 9: Monitor for 24 hours
  monitoringResult ← monitorProduction(deployedServices, duration: 86400)
  IF monitoringResult.errorRate > 0.05 OR monitoringResult.p95ResponseTime > 1000 THEN
    RETURN {status: "rollback_required", reason: "Performance degradation"}
  END IF
  
  RETURN {
    status: "success",
    services: deployedServices,
    dataIntegrity: verificationResult,
    monitoring: monitoringResult
  }
END
```

**Preconditions:**
- Render account is configured with payment method
- GitHub repository is connected to Render
- All environment variables are prepared
- Node.js database is accessible for export
- Django database is empty or ready for import

**Postconditions:**
- All four Django services are deployed and healthy
- Data is migrated with 100% integrity
- Frontend is configured to use Django backend
- Integration tests pass with >95% success rate
- Monitoring shows acceptable performance metrics

**Loop Invariants:**
- All deployed services remain healthy during deployment
- Data integrity is maintained throughout migration
- Rollback capability is available at each step

### Data Migration Algorithm

```pascal
ALGORITHM migrateData(nodejsDbUrl, djangoDbUrl)
INPUT: nodejsDbUrl (source), djangoDbUrl (destination)
OUTPUT: migrationResult with record counts and integrity status

BEGIN
  // Step 1: Export from Node.js
  tables ← ["users", "cadets", "staff", "activities", "attendance", "grades", ...]
  exportManifest ← {tables: {}, totalRecords: 0}
  
  FOR each table IN tables DO
    records ← exportTableToJSON(nodejsDbUrl, table)
    exportManifest.tables[table] ← records.length
    exportManifest.totalRecords ← exportManifest.totalRecords + records.length
    
    ASSERT records.length > 0 OR table IN optionalTables
  END FOR
  
  // Step 2: Transform data for Django
  FOR each table IN tables DO
    records ← readJSONFile(table + ".json")
    
    FOR each record IN records DO
      // Transform timestamps to UTC ISO 8601
      IF record.created_at IS NOT NULL THEN
        record.created_at ← toUTCISO8601(record.created_at)
      END IF
      
      // Transform booleans from 1/0 to true/false
      FOR each field IN record WHERE field.type = "boolean" DO
        record[field] ← record[field] = 1 ? true : false
      END FOR
      
      // Transform password hashes
      IF table = "users" AND record.password_hash IS NOT NULL THEN
        record.password_hash ← "bcrypt_sha256$" + record.password_hash
      END IF
    END FOR
    
    writeJSONFile(table + "_transformed.json", records)
  END FOR
  
  // Step 3: Import to Django (in dependency order)
  importManifest ← {tables: {}, totalRecords: 0}
  
  // Import users first (no dependencies)
  usersImported ← importTable(djangoDbUrl, "users", "authentication_user")
  importManifest.tables["users"] ← usersImported
  importManifest.totalRecords ← importManifest.totalRecords + usersImported
  
  // Import other tables in dependency order
  FOR each table IN ["cadets", "staff", "activities", ...] DO
    recordsImported ← importTable(djangoDbUrl, table, getDjangoTableName(table))
    importManifest.tables[table] ← recordsImported
    importManifest.totalRecords ← importManifest.totalRecords + recordsImported
  END FOR
  
  // Step 4: Verify integrity
  integrityResult ← {allMatch: true, discrepancies: []}
  
  FOR each table IN tables DO
    nodejsCount ← exportManifest.tables[table]
    djangoCount ← importManifest.tables[table]
    
    IF nodejsCount ≠ djangoCount THEN
      integrityResult.allMatch ← false
      integrityResult.discrepancies.add({
        table: table,
        expected: nodejsCount,
        actual: djangoCount
      })
    END IF
  END FOR
  
  // Step 5: Verify foreign keys
  orphanedRecords ← verifyForeignKeys(djangoDbUrl)
  IF orphanedRecords.length > 0 THEN
    integrityResult.allMatch ← false
    integrityResult.orphanedRecords ← orphanedRecords
  END IF
  
  RETURN {
    exported: exportManifest,
    imported: importManifest,
    integrity: integrityResult
  }
END
```

**Preconditions:**
- nodejsDbUrl is valid and database is accessible
- djangoDbUrl is valid and database is accessible
- Django database is empty or ready for import
- Sufficient disk space for JSON export files

**Postconditions:**
- All records exported from Node.js database
- All records imported to Django database
- Record counts match between source and destination
- Foreign key integrity is verified
- No orphaned records exist

**Loop Invariants:**
- Export manifest remains consistent during export
- Import manifest remains consistent during import
- Data transformations are applied consistently to all records


### Rollback Algorithm

```pascal
ALGORITHM rollbackToNodeJS(backupInfo, previousConfig)
INPUT: backupInfo (database backup metadata), previousConfig (Node.js configuration)
OUTPUT: rollbackResult with status and restored services

BEGIN
  ASSERT backupInfo.backupFile exists
  ASSERT previousConfig.NODEJS_DATABASE_URL is valid
  
  // Step 1: Stop Django services
  djangoServices ← ["web", "channels", "celery-worker", "celery-beat"]
  
  FOR each service IN djangoServices DO
    stopResult ← stopService(service)
    ASSERT stopResult.success = true
  END FOR
  
  // Step 2: Restore Node.js database from backup
  restoreResult ← restoreDatabaseBackup(backupInfo.backupFile, previousConfig.NODEJS_DATABASE_URL)
  IF NOT restoreResult.success THEN
    RETURN {status: "failed", error: "Database restore failed"}
  END IF
  
  // Step 3: Redeploy Node.js service
  nodejsDeployResult ← deployService("nodejs-backend", previousConfig)
  IF nodejsDeployResult.status ≠ "live" THEN
    RETURN {status: "failed", error: "Node.js service deployment failed"}
  END IF
  
  // Step 4: Update frontend configuration
  frontendConfig ← {
    VITE_API_URL: previousConfig.NODEJS_API_URL,
    VITE_WS_URL: previousConfig.NODEJS_WS_URL
  }
  frontendResult ← updateFrontendConfig(frontendConfig)
  ASSERT frontendResult.success = true
  
  // Step 5: Verify Node.js service health
  healthCheck ← checkServiceHealth(nodejsDeployResult.url + "/health")
  IF healthCheck.status ≠ "healthy" THEN
    RETURN {status: "failed", error: "Node.js service health check failed"}
  END IF
  
  // Step 6: Run smoke tests
  smokeTestResult ← runSmokeTests(nodejsDeployResult.url)
  IF smokeTestResult.passRate < 1.0 THEN
    RETURN {status: "failed", error: "Smoke tests failed"}
  END IF
  
  RETURN {
    status: "success",
    restoredService: nodejsDeployResult,
    databaseRestored: true,
    frontendUpdated: true
  }
END
```

**Preconditions:**
- Database backup exists and is valid
- Previous Node.js configuration is available
- Render account has access to previous deployment
- Frontend can be updated quickly

**Postconditions:**
- Django services are stopped
- Node.js database is restored from backup
- Node.js service is deployed and healthy
- Frontend is configured to use Node.js backend
- Smoke tests pass

**Loop Invariants:**
- Rollback can be completed within 15 minutes
- No data loss occurs during rollback
- Service availability is restored

## Key Functions with Formal Specifications

### Function 1: deployService()

```python
def deploy_service(service_name: str, config: dict) -> dict:
    """
    Deploy a service to Render
    
    Args:
        service_name: Name of the service (e.g., "rotc-django-web")
        config: Configuration dict with environment variables
    
    Returns:
        dict with status, url, and service_id
    """
    pass
```

**Preconditions:**
- `service_name` is non-empty string
- `config` contains all required environment variables
- `config['PORT']` binding is set to "0.0.0.0:$PORT"
- Render API credentials are valid

**Postconditions:**
- Service is deployed to Render
- Service status is "live"
- Service URL is accessible
- Health check endpoint returns 200 OK

**Loop Invariants:** N/A

### Function 2: exportTableToJSON()

```python
def export_table_to_json(db_url: str, table_name: str) -> list:
    """
    Export a database table to JSON format
    
    Args:
        db_url: PostgreSQL connection URL
        table_name: Name of the table to export
    
    Returns:
        list of dict records
    """
    pass
```

**Preconditions:**
- `db_url` is valid PostgreSQL connection string
- `table_name` exists in database
- Database is accessible

**Postconditions:**
- Returns list of records as dictionaries
- All datetime values are ISO 8601 strings
- All records are serializable to JSON
- No data loss during export

**Loop Invariants:**
- All processed records are valid JSON
- Record count matches database count

### Function 3: verifyDataIntegrity()

```python
def verify_data_integrity(source_db_url: str, dest_db_url: str) -> dict:
    """
    Verify data integrity between source and destination databases
    
    Args:
        source_db_url: Source database URL (Node.js)
        dest_db_url: Destination database URL (Django)
    
    Returns:
        dict with allMatch boolean and discrepancies list
    """
    pass
```

**Preconditions:**
- `source_db_url` is valid and accessible
- `dest_db_url` is valid and accessible
- Both databases have data

**Postconditions:**
- Returns dict with integrity verification results
- `allMatch` is true if all record counts match
- `discrepancies` list contains any mismatches
- Foreign key integrity is verified

**Loop Invariants:**
- All tables are checked for count matching
- All foreign keys are validated


## Example Usage

### Deployment Example

```python
# Deploy Django services to Render
from deployment.render_deploy import deploy_all_services

config = {
    'DJANGO_SETTINGS_MODULE': 'config.settings.production',
    'SECRET_KEY': 'django-insecure-...',
    'DATABASE_URL': 'postgresql://user:pass@host:5432/db',
    'REDIS_URL': 'redis://default:pass@host:6379',
    'ALLOWED_HOSTS': 'rotc-django-web.onrender.com',
    'CORS_ALLOWED_ORIGINS': 'https://msu-snd-rgms-1.onrender.com',
    'CLOUDINARY_CLOUD_NAME': 'your-cloud',
    'CLOUDINARY_API_KEY': 'your-key',
    'CLOUDINARY_API_SECRET': 'your-secret',
}

# Deploy all services
result = deploy_all_services(config)

if result['status'] == 'success':
    print(f"Deployed services: {result['services']}")
    print(f"Web URL: {result['services']['web']['url']}")
    print(f"Channels URL: {result['services']['channels']['url']}")
else:
    print(f"Deployment failed: {result['error']}")
```

### Data Migration Example

```python
# Migrate data from Node.js to Django
from scripts.migrate_data import migrate_all_data

nodejs_db_url = 'postgresql://user:pass@nodejs-host:5432/nodejs_db'
django_db_url = 'postgresql://user:pass@django-host:5432/django_db'

# Run migration
result = migrate_all_data(nodejs_db_url, django_db_url)

if result['integrity']['allMatch']:
    print(f"Migration successful: {result['imported']['totalRecords']} records")
else:
    print(f"Migration issues: {result['integrity']['discrepancies']}")
```

### Frontend API Integration Example

```javascript
// Login example
import apiClient from './utils/api';

async function login(username, password) {
  try {
    const response = await apiClient.post('/auth/login', {
      username,
      password
    });
    
    // Store JWT token
    localStorage.setItem('authToken', response.token);
    
    return { success: true, user: response.user };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// File upload example
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return { success: true, url: response.url };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// WebSocket connection example
import { WS_BASE_URL } from './utils/api';

function connectWebSocket() {
  const token = localStorage.getItem('authToken');
  const ws = new WebSocket(`${WS_BASE_URL}/ws/notifications/?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Notification:', data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}
```

### Rollback Example

```python
# Rollback to Node.js backend
from deployment.rollback import rollback_to_nodejs

backup_info = {
    'backupFile': '/backups/nodejs_db_2024-01-15.sql',
    'timestamp': '2024-01-15T10:00:00Z'
}

previous_config = {
    'NODEJS_DATABASE_URL': 'postgresql://user:pass@host:5432/nodejs_db',
    'NODEJS_API_URL': 'https://msu-snd-rgms-1.onrender.com',
    'NODEJS_WS_URL': 'wss://msu-snd-rgms-1.onrender.com'
}

# Execute rollback
result = rollback_to_nodejs(backup_info, previous_config)

if result['status'] == 'success':
    print("Rollback successful")
    print(f"Restored service: {result['restoredService']['url']}")
else:
    print(f"Rollback failed: {result['error']}")
```

## Correctness Properties

### Property 1: Port Binding Correctness

**Universal Quantification:**
```
∀ service ∈ {web, channels, celery-worker, celery-beat}:
  service.config.bind = "0.0.0.0:$PORT" ∧
  service.status = "live" ⟹
  service.isAccessible() = true
```

**Description:** All services must bind to the PORT environment variable provided by Render and be accessible.

**Validates: Requirements 1.1, 2.1**

### Property 2: Data Migration Integrity

**Universal Quantification:**
```
∀ table ∈ Tables:
  count(nodejs_db, table) = count(django_db, table) ∧
  ∀ record ∈ table:
    record.nodejs_db ≅ record.django_db (modulo type conversions)
```

**Description:** All records must be migrated with correct data transformations and no data loss.

**Validates: Requirements 5.2, 5.3, 6.2, 6.3, 6.4, 6.5, 7.1**

### Property 3: Foreign Key Integrity

**Universal Quantification:**
```
∀ record ∈ Records:
  ∀ fk ∈ record.foreign_keys:
    ∃ referenced_record ∈ referenced_table:
      referenced_record.id = fk.value
```

**Description:** All foreign key relationships must be preserved during migration with no orphaned records.

**Validates: Requirements 6.6, 7.3, 7.4**

### Property 4: Authentication Token Validity

**Universal Quantification:**
```
∀ request ∈ API_Requests:
  request.headers['Authorization'] = "Bearer <token>" ∧
  verify_jwt(token, SECRET_KEY) = true ⟹
  request.isAuthenticated() = true
```

**Description:** All authenticated requests must have valid JWT tokens signed with the correct SECRET_KEY.

**Validates: Requirements 8.3, 9.1, 9.2, 9.3**

### Property 5: Service Health Check

**Universal Quantification:**
```
∀ service ∈ {web, channels, celery-worker, celery-beat}:
  service.status = "live" ⟹
  service.healthCheck() = {
    status: "healthy",
    database: "connected",
    redis: "connected"
  }
```

**Description:** All live services must pass health checks with all dependencies connected.

**Validates: Requirements 1.3, 1.5, 1.6, 15.1, 15.2, 15.3, 15.4, 15.5**

### Property 6: Response Time Performance

**Universal Quantification:**
```
∀ request ∈ API_Requests:
  request.type = "read" ⟹
  percentile(response_time, 95) < 500ms
```

**Description:** 95th percentile response time for read operations must be under 500ms.

**Validates: Requirements 17.2, 17.3, 28.5**

### Property 7: Error Rate Threshold

**Universal Quantification:**
```
∀ time_window ∈ Production_Monitoring:
  error_rate(time_window) > 0.05 ⟹
  trigger_rollback() = true
```

**Description:** If error rate exceeds 5% in any monitoring window, rollback should be triggered.

**Validates: Requirements 16.5, 28.4**

### Property 8: WebSocket Connection Persistence

**Universal Quantification:**
```
∀ ws_connection ∈ WebSocket_Connections:
  ws_connection.authenticated = true ∧
  ws_connection.idle_time < 24_hours ⟹
  ws_connection.status = "open"
```

**Description:** Authenticated WebSocket connections should remain open for up to 24 hours.

### Property 9: Background Task Execution

**Universal Quantification:**
```
∀ task ∈ Celery_Tasks:
  task.queued_at + task.max_wait_time ≥ current_time ⟹
  task.status ∈ {"pending", "processing", "completed"}
```

**Description:** All queued tasks must be processed within their maximum wait time.

### Property 10: Rollback Completeness

**Universal Quantification:**
```
∀ rollback ∈ Rollback_Operations:
  rollback.initiated = true ⟹
  rollback.completion_time < 15_minutes ∧
  rollback.data_loss = 0 ∧
  rollback.service_restored = true
```

**Description:** All rollback operations must complete within 15 minutes with no data loss and service restored.


## Error Handling

### Error Scenario 1: Port Binding Failure

**Condition**: Django service fails to bind to PORT environment variable

**Response**: 
- Service deployment fails with error message
- Render logs show "Address already in use" or "Permission denied"
- Service status remains "deploying" or "failed"

**Recovery**:
1. Verify PORT environment variable is set correctly
2. Check gunicorn.conf.py or daphne.conf.py for correct binding: `bind = f"0.0.0.0:{port}"`
3. Ensure no hardcoded ports in configuration
4. Redeploy service after fixing configuration

### Error Scenario 2: Database Connection Failure

**Condition**: Django service cannot connect to PostgreSQL database

**Response**:
- Service health check fails
- Error: "OperationalError: could not connect to server"
- Service status shows "unhealthy"

**Recovery**:
1. Verify DATABASE_URL environment variable is correct
2. Check NeonDB service is running and accessible
3. Verify database credentials are valid
4. Check firewall rules allow connection from Render
5. Test connection using psql or Django shell

### Error Scenario 3: Redis Connection Failure

**Condition**: Django service cannot connect to Redis

**Response**:
- Celery workers fail to start
- WebSocket connections fail
- Cache operations fail
- Error: "ConnectionError: Error connecting to Redis"

**Recovery**:
1. Verify REDIS_URL environment variable is correct
2. Check Redis service is running
3. Verify Redis credentials are valid
4. Test connection using redis-cli
5. Check Redis memory usage (free tier has 25MB limit)

### Error Scenario 4: Data Migration Integrity Failure

**Condition**: Record counts don't match between Node.js and Django databases

**Response**:
- Verification script reports discrepancies
- Migration status: "failed"
- Detailed report shows which tables have mismatches

**Recovery**:
1. Review migration logs for errors
2. Check for foreign key constraint violations
3. Verify data transformation logic
4. Re-run export from Node.js database
5. Clear Django database and re-import
6. If persistent, investigate specific table issues

### Error Scenario 5: Frontend API Connection Failure

**Condition**: Frontend cannot connect to Django backend

**Response**:
- Network error in browser console
- Error: "Unable to connect to server"
- API requests timeout or fail

**Recovery**:
1. Verify VITE_API_URL is set correctly in .env.production
2. Check Django web service is deployed and healthy
3. Verify CORS_ALLOWED_ORIGINS includes frontend domain
4. Check Render service logs for errors
5. Test API endpoint directly with curl
6. Verify SSL certificate is valid

### Error Scenario 6: JWT Token Validation Failure

**Condition**: JWT tokens are invalid or expired

**Response**:
- 401 Unauthorized responses
- Error: "Token signature is invalid"
- Users are logged out unexpectedly

**Recovery**:
1. Verify SECRET_KEY is consistent across all services
2. Check JWT token expiration settings
3. Verify token is being sent in Authorization header
4. Clear browser localStorage and re-login
5. Check Django logs for JWT validation errors
6. Verify django-rest-framework-simplejwt is installed

### Error Scenario 7: File Upload Failure

**Condition**: File uploads to Cloudinary fail

**Response**:
- Upload returns error
- Error: "Cloudinary upload failed"
- Files are not stored

**Recovery**:
1. Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are set
2. Check Cloudinary account is active
3. Verify file size is within limits
4. Check Cloudinary storage quota
5. Test upload with Cloudinary API directly
6. Review Cloudinary logs for errors

### Error Scenario 8: Celery Task Failure

**Condition**: Background tasks fail to execute

**Response**:
- Task status: "failed"
- Error logged in Celery worker logs
- Task retries exhausted

**Recovery**:
1. Check Celery worker logs for error details
2. Verify CELERY_BROKER_URL and CELERY_RESULT_BACKEND are correct
3. Check Redis connection
4. Verify task code has no bugs
5. Check task timeout settings
6. Manually retry failed tasks
7. Increase max_retries if transient errors

### Error Scenario 9: WebSocket Disconnection

**Condition**: WebSocket connections drop unexpectedly

**Response**:
- Connection closed event
- Error: "WebSocket connection failed"
- Real-time updates stop working

**Recovery**:
1. Implement automatic reconnection logic in frontend
2. Check Django Channels service is running
3. Verify Redis channel layer is working
4. Check WebSocket timeout settings
5. Verify JWT token is valid
6. Test WebSocket connection with wscat

### Error Scenario 10: Deployment Rollback Required

**Condition**: Production metrics exceed error thresholds

**Response**:
- Error rate > 5%
- Response time > 1 second (95th percentile)
- Critical functionality broken

**Recovery**:
1. Execute rollback algorithm immediately
2. Stop all Django services
3. Restore Node.js database from backup
4. Redeploy Node.js service
5. Update frontend configuration to Node.js backend
6. Run smoke tests to verify restoration
7. Investigate Django deployment issues
8. Fix issues before attempting re-deployment

## Testing Strategy

### Unit Testing Approach

**Scope**: Individual functions and methods in Django backend

**Tools**:
- pytest
- pytest-django
- factory_boy for test data generation

**Coverage Goals**:
- 90% code coverage for business logic
- 100% coverage for critical paths (authentication, data migration)

**Key Test Cases**:
- Model validation and constraints
- API endpoint request/response handling
- JWT token generation and validation
- Data transformation functions
- File upload handling
- Error handling and edge cases

### Property-Based Testing Approach

**Property Test Library**: hypothesis (Python)

**Properties to Test**:
1. Data migration round-trip: export → import → verify produces identical data
2. JWT token generation: all generated tokens are valid and verifiable
3. API pagination: page size and offset calculations are correct for all inputs
4. File upload: all valid file types are accepted, invalid types are rejected
5. Password hashing: all passwords hash correctly and verify successfully
6. Foreign key integrity: all relationships are preserved during migration
7. Datetime conversion: all timestamps convert correctly between timezones
8. Boolean conversion: all boolean values convert correctly from 1/0 to true/false
9. Cache invalidation: cache is invalidated correctly on data updates
10. WebSocket message delivery: all messages are delivered to correct recipients

### Integration Testing Approach

**Scope**: End-to-end workflows across multiple services

**Tools**:
- pytest
- requests library for API testing
- websocket-client for WebSocket testing

**Test Scenarios**:
1. User registration → login → access protected endpoint
2. File upload → background processing → notification
3. Create activity → mark attendance → generate report
4. WebSocket connection → receive real-time update
5. Celery task queuing → execution → result retrieval
6. Database query → cache hit → cache invalidation
7. API request → authentication → authorization → response
8. Frontend API call → Django backend → database → response
9. Data migration → integrity verification → rollback
10. Service deployment → health check → monitoring

### Performance Testing Approach

**Tools**:
- locust for load testing
- pytest-benchmark for performance benchmarks

**Metrics**:
- Response time (mean, median, 95th percentile, 99th percentile)
- Throughput (requests per second)
- Error rate
- Database query count and time
- Cache hit rate
- Memory usage
- CPU usage

**Load Test Scenarios**:
1. 100 concurrent users accessing dashboard
2. 50 concurrent file uploads
3. 1000 API requests per minute
4. 100 concurrent WebSocket connections
5. 10 concurrent report generations

**Performance Targets**:
- 95th percentile response time < 500ms for read operations
- 95th percentile response time < 2000ms for write operations
- Error rate < 1% under normal load
- Cache hit rate > 80% for frequently accessed data
- Database query time < 100ms for simple queries


## Performance Considerations

### Database Optimization

**Indexing Strategy**:
- Primary keys: Auto-indexed by Django
- Foreign keys: Auto-indexed by Django
- Frequently queried fields: Add database indexes
- Composite indexes for multi-field queries

```python
# Example model with indexes
class Attendance(models.Model):
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, db_index=True)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, db_index=True)
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, db_index=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['cadet', 'date']),
            models.Index(fields=['activity', 'date']),
            models.Index(fields=['date', 'status']),
        ]
```

**Query Optimization**:
- Use select_related() for foreign key relationships
- Use prefetch_related() for many-to-many relationships
- Avoid N+1 queries
- Use only() and defer() to limit fields
- Use database-level aggregation

**Connection Pooling**:
- NeonDB supports connection pooling
- Configure max_connections in DATABASE_URL
- Use persistent connections in Django settings

### Caching Strategy

**Cache Levels**:
1. Database query cache (Redis)
2. API response cache (Redis)
3. Static file cache (WhiteNoise)
4. Browser cache (HTTP headers)

**Cache Configuration**:
```python
# config/settings/production.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PARSER_CLASS': 'redis.connection.HiredisParser',
            'CONNECTION_POOL_CLASS_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            },
        },
        'KEY_PREFIX': 'rotc',
        'TIMEOUT': 300,  # 5 minutes default
    }
}
```

**Cache Invalidation**:
- Invalidate on data updates
- Use cache versioning for schema changes
- Set appropriate TTL for different data types
- Use cache tags for bulk invalidation

### Static File Optimization

**WhiteNoise Configuration**:
```python
# config/settings/production.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # After SecurityMiddleware
    # ... other middleware
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Compression and caching
WHITENOISE_COMPRESS_OFFLINE = True
WHITENOISE_MAX_AGE = 31536000  # 1 year
```

**Frontend Build Optimization**:
- Code splitting for lazy loading
- Tree shaking to remove unused code
- Minification and compression
- Image optimization (WebP format)
- CDN for static assets (Cloudinary)

### Background Task Optimization

**Celery Configuration**:
- Use appropriate concurrency level (2 for Starter plan)
- Set task time limits to prevent hanging
- Use task priorities for critical tasks
- Implement task result expiration
- Use task routing for different queues

**Task Optimization**:
- Batch operations where possible
- Use database bulk operations
- Implement task chunking for large datasets
- Use task chaining for dependent operations
- Implement exponential backoff for retries

### WebSocket Optimization

**Channels Configuration**:
- Use Redis channel layer for scalability
- Configure appropriate message expiry
- Implement connection pooling
- Use group messaging for broadcasts
- Implement heartbeat/ping for connection health

**Message Optimization**:
- Minimize message payload size
- Use binary format for large data
- Implement message compression
- Use selective broadcasting (only to relevant clients)
- Implement message queuing for offline clients

### API Response Optimization

**Pagination**:
- Default page size: 20 items
- Maximum page size: 100 items
- Use cursor-based pagination for large datasets
- Include total count in response

**Response Compression**:
- Enable gzip compression in Gunicorn
- Compress responses > 1KB
- Use appropriate compression level (6)

**Field Selection**:
- Allow clients to specify fields to return
- Implement sparse fieldsets
- Use GraphQL for complex queries (future enhancement)

## Security Considerations

### Authentication and Authorization

**JWT Token Security**:
- Use strong SECRET_KEY (256-bit minimum)
- Set appropriate token expiration (15 minutes for access, 7 days for refresh)
- Implement token rotation
- Store tokens securely (httpOnly cookies or localStorage with XSS protection)
- Validate token signature on every request

**Password Security**:
- Use BCryptSHA256PasswordHasher
- Minimum password length: 8 characters
- Require password complexity (uppercase, lowercase, numbers, special chars)
- Implement password reset with email verification
- Rate limit login attempts (5 attempts per 15 minutes)

**Role-Based Access Control**:
- Implement Django permissions system
- Define roles: admin, staff, cadet
- Enforce permissions at API endpoint level
- Implement object-level permissions for sensitive data
- Audit permission changes

### Data Protection

**Encryption**:
- Use HTTPS for all communications (enforced by Render)
- Encrypt sensitive data at rest (database encryption)
- Use secure environment variables for secrets
- Implement field-level encryption for PII

**Data Validation**:
- Validate all input data
- Sanitize user input to prevent injection attacks
- Use Django's built-in validators
- Implement custom validators for business rules
- Validate file uploads (type, size, content)

**CORS Configuration**:
```python
# config/settings/production.py
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = ['Authorization', 'Content-Type', 'X-Requested-With']
```

### API Security

**Rate Limiting**:
```python
# Use django-ratelimit
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='100/h', method='POST')
def api_endpoint(request):
    pass
```

**CSRF Protection**:
- Enable CSRF protection for state-changing operations
- Use CSRF tokens in forms
- Exempt API endpoints that use JWT authentication

**SQL Injection Prevention**:
- Use Django ORM (parameterized queries)
- Never use raw SQL with user input
- Validate and sanitize all input

**XSS Prevention**:
- Escape all user-generated content
- Use Django's template auto-escaping
- Set Content-Security-Policy headers
- Sanitize HTML input

### Infrastructure Security

**Environment Variables**:
- Never commit secrets to Git
- Use Render's environment variable management
- Rotate secrets regularly
- Use different secrets for different environments

**Database Security**:
- Use strong database passwords
- Restrict database access to Render services only
- Enable SSL for database connections
- Regular database backups
- Implement point-in-time recovery

**Monitoring and Alerting**:
- Enable Sentry for error tracking
- Monitor failed login attempts
- Alert on unusual activity patterns
- Log all security-relevant events
- Implement audit logging

**Security Headers**:
```python
# config/settings/production.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

## Dependencies

### Python Dependencies (requirements.txt)

**Core Django**:
- Django >= 5.0, < 6.0
- djangorestframework >= 3.14, < 4.0
- djangorestframework-simplejwt >= 5.3, < 6.0

**Database**:
- psycopg2-binary >= 2.9, < 3.0
- dj-database-url >= 2.1, < 3.0

**Caching and Background Tasks**:
- celery >= 5.3, < 6.0
- redis >= 5.0, < 6.0
- django-redis >= 5.4, < 6.0
- django-celery-results >= 2.5, < 3.0
- django-celery-beat >= 2.5, < 3.0

**WebSocket Support**:
- channels >= 4.0, < 5.0
- channels-redis >= 4.1, < 5.0
- daphne >= 4.0, < 5.0

**File Storage**:
- django-storages >= 1.14, < 2.0
- cloudinary >= 1.36, < 2.0
- Pillow >= 10.0, < 11.0

**Document Processing**:
- ReportLab >= 4.0, < 5.0
- pytesseract >= 0.3, < 1.0

**Production Server**:
- gunicorn >= 21.2, < 22.0
- whitenoise >= 6.6, < 7.0

**Security**:
- bcrypt >= 4.1, < 5.0
- django-ratelimit >= 4.1, < 5.0

**Monitoring**:
- sentry-sdk >= 1.40, < 2.0
- prometheus-client >= 0.19, < 1.0

### External Services

**NeonDB PostgreSQL**:
- Serverless PostgreSQL database
- Auto-scaling
- Connection pooling
- Point-in-time recovery

**Redis (Upstash or Redis Labs)**:
- Persistent Redis instance
- Used for caching, Celery broker, and Channels layer
- Minimum 25MB storage (free tier)

**Cloudinary**:
- Media storage and CDN
- Image optimization and transformation
- Video support
- Free tier: 25GB storage, 25GB bandwidth

**Sentry.io**:
- Error tracking and monitoring
- Performance monitoring
- Release tracking
- Free tier: 5K errors/month

**Render.com**:
- Web service hosting
- Worker service hosting
- Automatic deployments
- SSL certificates
- Load balancing
- Starter plan: $7/month per service

### Frontend Dependencies (package.json)

**Core**:
- react ^18.2.0
- react-dom ^18.2.0
- react-router-dom ^6.14.2
- vite ^5.0.0

**HTTP Client**:
- axios ^1.4.0

**UI Components**:
- lucide-react ^0.263.1
- react-hot-toast ^2.6.0
- recharts ^3.7.0

**Utilities**:
- clsx ^1.2.1
- tailwind-merge ^1.14.0
- idb ^8.0.3

**Build Tools**:
- @vitejs/plugin-react ^4.0.3
- tailwindcss ^3.3.3
- postcss ^8.4.27
- autoprefixer ^10.4.14

**PWA Support**:
- vite-plugin-pwa ^0.16.5
- workbox-core ^7.4.0
- workbox-precaching ^7.4.0

**Mobile/Desktop**:
- @capacitor/android ^8.0.2
- @capacitor/core ^8.0.2
- electron ^40.1.0
