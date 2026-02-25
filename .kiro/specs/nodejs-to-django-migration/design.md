# Design Document: ROTC Grading System Migration (Node.js to Django)

## Overview

This design document specifies the technical architecture for migrating the ROTC Grading System from Node.js/Express to Python/Django while maintaining 100% feature parity and zero data loss. The migration replaces the backend infrastructure while preserving the React frontend, mobile apps (Android/Capacitor), and desktop app (Electron) without requiring changes to client applications.

### System Context

The current system is a full-stack web application serving three user roles (Admin, Cadet, Training Staff) with comprehensive features including user management, grading, attendance tracking, activities management, messaging, notifications, file uploads, and real-time updates. The system manages 19 database tables with complex relationships and integrates with external services (Cloudinary for file storage, push notification services).

### Migration Goals

1. **Feature Parity**: Replicate all functionality from the Node.js backend
2. **API Compatibility**: Maintain identical API contracts to avoid frontend changes
3. **Data Preservation**: Migrate all data without loss or corruption
4. **Performance**: Match or exceed current system performance
5. **Maintainability**: Leverage Django's ecosystem for improved developer experience
6. **Scalability**: Support future growth with Django's robust architecture

### Technology Stack

**Backend Framework**:
- Django 5.0+ (web framework)
- Django REST Framework 3.14+ (API layer)
- Python 3.11+ (runtime)

**Database**:
- PostgreSQL 15+ (production)
- SQLite 3 (development)

**Real-time & Background Processing**:
- Django Channels 4.0+ (WebSocket support)
- Celery 5.3+ (distributed task queue)
- Redis 7.0+ (message broker, cache, channel layer)

**File Storage**:
- Cloudinary (cloud storage via django-storages)
- Pillow (image processing)

**Additional Libraries**:
- ReportLab (PDF generation)
- pytesseract (OCR processing)
- django-push-notifications (mobile push)
- bcrypt (password hashing compatibility)
- gunicorn (WSGI server)
- daphne (ASGI server for WebSocket)


## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ React Web    │  │ Android App  │  │ Electron App │          │
│  │ (SPA)        │  │ (Capacitor)  │  │ (Desktop)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │ HTTP/REST API    │ HTTP/REST API    │ HTTP/REST API
          │ WebSocket        │ WebSocket        │ WebSocket
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────────┐
│                     Django Backend Layer                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Django REST Framework (API)                   │ │
│  │  - Authentication & Authorization                          │ │
│  │  - ViewSets & Serializers                                  │ │
│  │  - CORS Configuration                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Django Channels (WebSocket)                   │ │
│  │  - Real-time grade updates                                 │ │
│  │  - Notification broadcasting                               │ │
│  │  - Connection management                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Business Logic Layer                     │ │
│  │  - Models (ORM)                                            │ │
│  │  - Services                                                │ │
│  │  - Validators                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
          │                  │                  │
          │                  │                  │
┌─────────▼─────────┐ ┌──────▼──────┐ ┌────────▼────────┐
│   PostgreSQL      │ │    Redis    │ │   Cloudinary    │
│   (Database)      │ │  (Cache &   │ │  (File Storage) │
│                   │ │   Broker)   │ │                 │
└───────────────────┘ └─────────────┘ └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Celery Workers │
                    │  - Image proc   │
                    │  - PDF gen      │
                    │  - OCR tasks    │
                    │  - Bulk import  │
                    └─────────────────┘
```

### Layered Architecture

**Presentation Layer** (Django REST Framework):
- API endpoints matching Node.js routes
- Request validation and serialization
- Response formatting for API compatibility
- CORS handling for cross-origin requests
- Authentication middleware

**Application Layer** (Django Views & Services):
- Business logic implementation
- Service classes for complex operations
- Permission checking and authorization
- Cache management
- Event broadcasting coordination

**Domain Layer** (Django Models):
- Database schema definition
- Model relationships and constraints
- Custom model methods
- Signal handlers for audit logging
- Data validation rules

**Infrastructure Layer**:
- Database connections (PostgreSQL/SQLite)
- Redis connections (cache & Celery)
- Cloudinary integration
- External service integrations
- Background task processing

### Component Interaction Patterns

**Synchronous Request Flow**:
1. Client sends HTTP request to Django REST Framework endpoint
2. Authentication middleware validates JWT token
3. Permission classes check role-based access
4. ViewSet processes request using serializers
5. Service layer executes business logic
6. Model layer interacts with database via ORM
7. Response serialized and returned to client

**Asynchronous Task Flow**:
1. API endpoint receives request requiring background processing
2. Celery task queued to Redis broker
3. API returns immediate response with task ID
4. Celery worker picks up task from queue
5. Worker executes task (image processing, PDF generation, etc.)
6. Result stored in Redis or database
7. Client polls status endpoint or receives WebSocket notification

**Real-time Update Flow**:
1. Data modification occurs (grade update, new message)
2. Django signal triggers sync event creation
3. Channels consumer broadcasts event via WebSocket
4. Connected clients receive real-time update
5. Frontend updates UI without page refresh


## Components and Interfaces

### Django Project Structure

```
rotc_backend/
├── manage.py
├── requirements.txt
├── render.yaml
├── .env.example
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py          # Shared settings
│   │   ├── development.py   # Dev-specific settings
│   │   └── production.py    # Production settings
│   ├── urls.py              # Root URL configuration
│   ├── asgi.py              # ASGI config for Channels
│   └── wsgi.py              # WSGI config for gunicorn
├── apps/
│   ├── authentication/      # Auth & user management
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── permissions.py
│   │   └── utils.py
│   ├── cadets/              # Cadet management
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── services.py
│   ├── grading/             # Grades & merit/demerit
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── services.py
│   ├── attendance/          # Training days & attendance
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── services.py
│   ├── activities/          # Activities & achievements
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── tasks.py
│   ├── staff/               # Training staff management
│   │   ├── models.py
│   │   ├── serializers.py
│   │   └── views.py
│   ├── messaging/           # Messages & notifications
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── consumers.py     # WebSocket consumers
│   ├── files/               # File uploads & Cloudinary
│   │   ├── views.py
│   │   ├── storage.py
│   │   └── tasks.py
│   ├── reports/             # PDF generation
│   │   ├── views.py
│   │   ├── generators.py
│   │   └── tasks.py
│   ├── system/              # System settings & audit
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── middleware.py
│   └── integration/         # ROTCMIS import/export
│       ├── views.py
│       ├── importers.py
│       └── exporters.py
├── core/
│   ├── __init__.py
│   ├── cache.py             # Cache utilities
│   ├── exceptions.py        # Custom exceptions
│   ├── pagination.py        # Custom pagination
│   └── utils.py             # Shared utilities
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── scripts/
    ├── migrate_data.py      # Data migration script
    └── verify_migration.py  # Migration verification
```

### Core Components

#### 1. Authentication Component

**Purpose**: Handle user authentication, authorization, and session management with bcrypt compatibility.

**Models**:
- `User`: Core user model with role-based access
- `UserSettings`: User preferences and customization

**Key Interfaces**:
```python
# POST /api/auth/login
Request: {"username": str, "password": str}
Response: {"token": str, "user": UserProfile, "role": str}

# POST /api/auth/register
Request: {"username": str, "email": str, "password": str, "role": str}
Response: {"user": UserProfile, "is_approved": bool}

# POST /api/auth/logout
Request: {"token": str}
Response: {"message": str}

# GET /api/auth/profile
Response: UserProfile with related cadet/staff data
```

**Implementation Details**:
- Use `bcrypt` library for password hashing (compatible with bcryptjs)
- JWT token generation using `djangorestframework-simplejwt`
- Custom authentication backend for bcrypt verification
- Token-based authentication for API requests
- Role-based permission classes: `IsAdmin`, `IsCadet`, `IsTrainingStaff`

#### 2. Cadet Management Component

**Purpose**: CRUD operations for cadet records with profile management.

**Models**:
- `Cadet`: Student profile with personal and academic information
- `Grades`: Associated grade record (one-to-one relationship)

**Key Interfaces**:
```python
# GET /api/cadets
Query params: {company, platoon, course, year_level, status, search}
Response: List[CadetWithGrades]

# POST /api/cadets
Request: CadetCreateData
Response: Cadet (auto-creates associated Grades record)

# PUT /api/cadets/:id
Request: CadetUpdateData
Response: Cadet

# DELETE /api/cadets/:id (soft delete)
Response: {"message": str, "is_archived": true}
```

**Implementation Details**:
- Soft delete using `is_archived` flag
- Automatic grade record creation via Django signals
- Profile completion tracking
- Search functionality using Q objects
- Filtering using django-filter

#### 3. Grading Component

**Purpose**: Manage cadet grades, merit/demerit points, and academic scores.

**Models**:
- `Grades`: Aggregate grade data per cadet
- `MeritDemeritLog`: Individual merit/demerit entries with audit trail

**Key Interfaces**:
```python
# GET /api/grades/:cadet_id
Response: GradeDetails with merit/demerit history

# PUT /api/grades/:cadet_id
Request: {attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score}
Response: UpdatedGrades

# POST /api/merit-demerit
Request: {cadet_id, type, points, reason, issued_by_user_id}
Response: MeritDemeritLog (auto-updates Grades)
```

**Implementation Details**:
- Automatic grade calculation on merit/demerit changes
- Audit logging via Django signals
- Sync event creation for real-time updates
- Transaction management for data consistency


#### 4. Attendance Component

**Purpose**: Track cadet and staff attendance for training days.

**Models**:
- `TrainingDay`: Scheduled training sessions
- `AttendanceRecord`: Cadet attendance with status tracking
- `StaffAttendanceRecord`: Staff attendance tracking

**Key Interfaces**:
```python
# POST /api/training-days
Request: {date, title, description, location}
Response: TrainingDay

# POST /api/attendance
Request: {training_day_id, cadet_id, status, time_in, time_out}
Response: AttendanceRecord (updates Grades.attendance_present)

# POST /api/attendance/bulk
Request: {training_day_id, cadet_ids[], status}
Response: List[AttendanceRecord]

# POST /api/attendance/qr-checkin
Request: {training_day_id, cadet_id, qr_code}
Response: AttendanceRecord
```

**Implementation Details**:
- Unique constraint on (training_day_id, cadet_id)
- Status validation: present, absent, late, excused
- Automatic grade update on attendance changes
- QR code generation and validation
- Bulk attendance creation for efficiency

#### 5. File Upload Component

**Purpose**: Handle file uploads to Cloudinary with image processing.

**Models**:
- `ActivityImage`: Multiple images per activity

**Key Interfaces**:
```python
# POST /api/upload
Request: multipart/form-data {file, type, entity_id}
Response: {url: str, public_id: str, format: str}

# DELETE /api/upload/:public_id
Response: {message: str, deleted: bool}
```

**Implementation Details**:
- Cloudinary integration via django-storages
- Image compression using Pillow before upload
- File type and size validation
- Async processing via Celery for large files
- Support for profile pictures, excuse letters, activity images

#### 6. Messaging Component

**Purpose**: Admin messages and staff chat with real-time updates.

**Models**:
- `AdminMessage`: User-to-admin communication
- `StaffMessage`: Staff chat messages
- `Notification`: System notifications

**Key Interfaces**:
```python
# POST /api/messages/admin
Request: {subject, message}
Response: AdminMessage (creates notification)

# POST /api/messages/staff
Request: {content, sender_staff_id}
Response: StaffMessage (broadcasts via WebSocket)

# GET /api/notifications
Response: List[Notification] (filtered by user)

# PUT /api/notifications/:id/read
Response: Notification (is_read=true)
```

**Implementation Details**:
- WebSocket broadcasting for real-time chat
- Push notification integration
- Notification filtering by user and read status
- Message status tracking (pending, replied)

#### 7. Real-time Updates Component (Django Channels)

**Purpose**: WebSocket connections for real-time data synchronization.

**Consumers**:
- `UpdatesConsumer`: Broadcasts grade changes, notifications, messages

**Key Interfaces**:
```python
# WebSocket: /ws/updates/
Connection: Authenticated via token in query params
Messages: {
    "type": "grade_update" | "notification" | "message",
    "data": {...}
}
```

**Implementation Details**:
- Redis channel layer for message distribution
- Token-based WebSocket authentication
- Room-based broadcasting (user-specific, role-specific)
- Automatic reconnection handling
- Backward compatibility with SSE via long-polling endpoint

#### 8. Background Tasks Component (Celery)

**Purpose**: Asynchronous processing of long-running operations.

**Task Categories**:
- Image processing and compression
- PDF report generation
- OCR document scanning
- Bulk data imports
- Email notifications
- Scheduled cleanup tasks

**Key Tasks**:
```python
@shared_task
def compress_and_upload_image(image_path, entity_type, entity_id)

@shared_task
def generate_pdf_report(report_type, filters, user_id)

@shared_task
def process_ocr_document(file_url, excuse_letter_id)

@shared_task
def import_rotcmis_data(json_data, user_id)

@shared_task
def send_push_notifications(notification_id, user_ids)
```

**Implementation Details**:
- Redis as message broker
- Task result backend in Redis
- Retry logic with exponential backoff
- Task monitoring and health checks
- Periodic tasks using Celery Beat

#### 9. Caching Component

**Purpose**: Redis-based caching for performance optimization.

**Cache Strategy**:
- Cadet lists: 5-minute TTL
- Grade summaries: 5-minute TTL
- Training day lists: 10-minute TTL
- System settings: 30-minute TTL
- API responses: Conditional caching

**Implementation Details**:
```python
# Cache key patterns
CACHE_KEYS = {
    'cadet_list': 'cadets:list:{filters_hash}',
    'cadet_detail': 'cadets:detail:{id}',
    'grades': 'grades:{cadet_id}',
    'training_days': 'training_days:list',
    'system_settings': 'system:settings:{key}',
}

# Cache invalidation on updates
def invalidate_cadet_cache(cadet_id):
    cache.delete_pattern(f'cadets:*')
    cache.delete(f'grades:{cadet_id}')
```

**Cache Invalidation Rules**:
- Cadet update → invalidate cadet lists and detail
- Grade update → invalidate grade cache and cadet detail
- Training day update → invalidate training day lists
- System setting update → invalidate specific setting cache


## Data Models

### Database Schema Overview

The Django backend replicates the exact schema from the Node.js system with 19 tables. All table names, column names, constraints, and relationships are preserved for seamless data migration.

### Model Definitions

#### User Management Models

**User Model**:
```python
class User(models.Model):
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)  # bcrypt hash
    role = models.CharField(
        max_length=20,
        choices=[('admin', 'Admin'), ('cadet', 'Cadet'), ('training_staff', 'Training Staff')]
    )
    is_approved = models.BooleanField(default=False)
    cadet_id = models.IntegerField(null=True, blank=True)
    staff_id = models.IntegerField(null=True, blank=True)
    profile_pic = models.TextField(null=True, blank=True)  # Cloudinary URL
    last_latitude = models.FloatField(null=True, blank=True)
    last_longitude = models.FloatField(null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
```

**UserSettings Model**:
```python
class UserSettings(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    email_alerts = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)
    activity_updates = models.BooleanField(default=True)
    dark_mode = models.BooleanField(default=False)
    compact_mode = models.BooleanField(default=False)
    primary_color = models.CharField(max_length=50, default='blue')
    custom_bg = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_settings'
```

#### Cadet and Grading Models

**Cadet Model**:
```python
class Cadet(models.Model):
    id = models.AutoField(primary_key=True)
    student_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    middle_name = models.CharField(max_length=255, null=True, blank=True)
    suffix_name = models.CharField(max_length=50, null=True, blank=True)
    company = models.CharField(max_length=50, null=True, blank=True)
    platoon = models.CharField(max_length=50, null=True, blank=True)
    course = models.CharField(max_length=255, null=True, blank=True)
    year_level = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Ongoing')
    profile_pic = models.TextField(null=True, blank=True)
    contact_number = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    birthdate = models.DateField(null=True, blank=True)
    birthplace = models.CharField(max_length=255, null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)
    height = models.CharField(max_length=50, null=True, blank=True)
    weight = models.CharField(max_length=50, null=True, blank=True)
    blood_type = models.CharField(max_length=10, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    civil_status = models.CharField(max_length=50, null=True, blank=True)
    nationality = models.CharField(max_length=100, null=True, blank=True)
    gender = models.CharField(max_length=20, null=True, blank=True)
    language_spoken = models.CharField(max_length=255, null=True, blank=True)
    combat_boots_size = models.CharField(max_length=20, null=True, blank=True)
    uniform_size = models.CharField(max_length=20, null=True, blank=True)
    bullcap_size = models.CharField(max_length=20, null=True, blank=True)
    facebook_link = models.TextField(null=True, blank=True)
    rotc_unit = models.CharField(max_length=255, null=True, blank=True)
    mobilization_center = models.CharField(max_length=255, null=True, blank=True)
    is_profile_completed = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'cadets'
        indexes = [
            models.Index(fields=['student_id']),
            models.Index(fields=['company', 'platoon']),
            models.Index(fields=['is_archived']),
        ]
```

**Grades Model**:
```python
class Grades(models.Model):
    id = models.AutoField(primary_key=True)
    cadet = models.OneToOneField(Cadet, on_delete=models.CASCADE, related_name='grades')
    attendance_present = models.IntegerField(default=0)
    merit_points = models.IntegerField(default=0)
    demerit_points = models.IntegerField(default=0)
    prelim_score = models.FloatField(null=True, blank=True)
    midterm_score = models.FloatField(null=True, blank=True)
    final_score = models.FloatField(null=True, blank=True)
    
    class Meta:
        db_table = 'grades'
```

**MeritDemeritLog Model**:
```python
class MeritDemeritLog(models.Model):
    id = models.AutoField(primary_key=True)
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, related_name='merit_demerit_logs')
    type = models.CharField(
        max_length=10,
        choices=[('merit', 'Merit'), ('demerit', 'Demerit')]
    )
    points = models.IntegerField()
    reason = models.TextField()
    issued_by_user_id = models.IntegerField()
    issued_by_name = models.CharField(max_length=255)
    date_recorded = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'merit_demerit_logs'
        indexes = [
            models.Index(fields=['cadet', 'date_recorded']),
        ]
```

#### Attendance Models

**TrainingDay Model**:
```python
class TrainingDay(models.Model):
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'training_days'
        ordering = ['-date']
```

**AttendanceRecord Model**:
```python
class AttendanceRecord(models.Model):
    id = models.AutoField(primary_key=True)
    training_day = models.ForeignKey(TrainingDay, on_delete=models.CASCADE, related_name='attendance_records')
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, related_name='attendance_records')
    status = models.CharField(
        max_length=20,
        choices=[('present', 'Present'), ('absent', 'Absent'), ('late', 'Late'), ('excused', 'Excused')]
    )
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'attendance_records'
        unique_together = [['training_day', 'cadet']]
        indexes = [
            models.Index(fields=['training_day', 'status']),
        ]
```

**StaffAttendanceRecord Model**:
```python
class StaffAttendanceRecord(models.Model):
    id = models.AutoField(primary_key=True)
    training_day = models.ForeignKey(TrainingDay, on_delete=models.CASCADE, related_name='staff_attendance')
    staff = models.ForeignKey('TrainingStaff', on_delete=models.CASCADE, related_name='attendance_records')
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'staff_attendance_records'
        unique_together = [['training_day', 'staff']]
```

**ExcuseLetter Model**:
```python
class ExcuseLetter(models.Model):
    id = models.AutoField(primary_key=True)
    cadet = models.ForeignKey(Cadet, on_delete=models.CASCADE, related_name='excuse_letters')
    training_day = models.ForeignKey(TrainingDay, on_delete=models.SET_NULL, null=True, blank=True)
    date_absent = models.DateField()
    reason = models.TextField()
    file_url = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'excuse_letters'
        indexes = [
            models.Index(fields=['cadet', 'status']),
        ]
```


#### Activity and Staff Models

**Activity Model**:
```python
class Activity(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    date = models.DateField()
    image_path = models.TextField(null=True, blank=True)
    images = models.TextField(null=True, blank=True)  # JSON array of URLs
    type = models.CharField(
        max_length=50,
        choices=[('activity', 'Activity'), ('achievement', 'Achievement'), ('event', 'Event')],
        default='activity'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'activities'
        ordering = ['-date']
```

**ActivityImage Model**:
```python
class ActivityImage(models.Model):
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='activity_images')
    image_url = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'activity_images'
```

**TrainingStaff Model**:
```python
class TrainingStaff(models.Model):
    id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    middle_name = models.CharField(max_length=255, null=True, blank=True)
    suffix_name = models.CharField(max_length=50, null=True, blank=True)
    rank = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(unique=True)
    contact_number = models.CharField(max_length=50, null=True, blank=True)
    role = models.CharField(max_length=100, null=True, blank=True)
    profile_pic = models.TextField(null=True, blank=True)
    afpsn = models.CharField(max_length=50, null=True, blank=True)
    birthdate = models.DateField(null=True, blank=True)
    birthplace = models.CharField(max_length=255, null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)
    height = models.CharField(max_length=50, null=True, blank=True)
    weight = models.CharField(max_length=50, null=True, blank=True)
    blood_type = models.CharField(max_length=10, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    civil_status = models.CharField(max_length=50, null=True, blank=True)
    nationality = models.CharField(max_length=100, null=True, blank=True)
    gender = models.CharField(max_length=20, null=True, blank=True)
    language_spoken = models.CharField(max_length=255, null=True, blank=True)
    combat_boots_size = models.CharField(max_length=20, null=True, blank=True)
    uniform_size = models.CharField(max_length=20, null=True, blank=True)
    bullcap_size = models.CharField(max_length=20, null=True, blank=True)
    facebook_link = models.TextField(null=True, blank=True)
    rotc_unit = models.CharField(max_length=255, null=True, blank=True)
    mobilization_center = models.CharField(max_length=255, null=True, blank=True)
    is_profile_completed = models.BooleanField(default=False)
    has_seen_guide = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'training_staff'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['is_archived']),
        ]
```

#### Messaging and Notification Models

**AdminMessage Model**:
```python
class AdminMessage(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_messages')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('replied', 'Replied')],
        default='pending'
    )
    admin_reply = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'admin_messages'
        ordering = ['-created_at']
```

**StaffMessage Model**:
```python
class StaffMessage(models.Model):
    id = models.AutoField(primary_key=True)
    sender_staff = models.ForeignKey(TrainingStaff, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'staff_messages'
        ordering = ['created_at']
```

**Notification Model**:
```python
class Notification(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    type = models.CharField(max_length=50)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]
```

**PushSubscription Model**:
```python
class PushSubscription(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField()
    keys = models.JSONField()  # {p256dh, auth}
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'push_subscriptions'
```

#### System Models

**SystemSettings Model**:
```python
class SystemSettings(models.Model):
    id = models.AutoField(primary_key=True)
    key = models.CharField(max_length=255, unique=True)
    value = models.TextField()
    
    class Meta:
        db_table = 'system_settings'
```

**AuditLog Model**:
```python
class AuditLog(models.Model):
    id = models.AutoField(primary_key=True)
    table_name = models.CharField(max_length=255)
    operation = models.CharField(
        max_length=10,
        choices=[('CREATE', 'Create'), ('UPDATE', 'Update'), ('DELETE', 'Delete')]
    )
    record_id = models.IntegerField()
    user_id = models.IntegerField(null=True, blank=True)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['table_name', 'operation']),
            models.Index(fields=['created_at']),
        ]
```

**SyncEvent Model**:
```python
class SyncEvent(models.Model):
    id = models.AutoField(primary_key=True)
    event_type = models.CharField(max_length=50)
    cadet_id = models.IntegerField(null=True, blank=True)
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sync_events'
        indexes = [
            models.Index(fields=['processed', 'created_at']),
        ]
```

### Model Relationships

**One-to-One Relationships**:
- User ↔ UserSettings
- Cadet ↔ Grades

**One-to-Many Relationships**:
- User → AdminMessage
- User → Notification
- User → PushSubscription
- Cadet → MeritDemeritLog
- Cadet → AttendanceRecord
- Cadet → ExcuseLetter
- TrainingDay → AttendanceRecord
- TrainingDay → StaffAttendanceRecord
- TrainingStaff → StaffAttendanceRecord
- TrainingStaff → StaffMessage
- Activity → ActivityImage

**Foreign Key Behaviors**:
- CASCADE: Delete related records when parent is deleted (most relationships)
- SET_NULL: Set to null when parent is deleted (ExcuseLetter.training_day)

### Database Indexes

Performance-critical indexes:
- `users.username`, `users.email`, `users.role`
- `cadets.student_id`, `cadets.company`, `cadets.platoon`, `cadets.is_archived`
- `attendance_records.training_day`, `attendance_records.status`
- `notifications.user`, `notifications.is_read`
- `audit_logs.table_name`, `audit_logs.operation`, `audit_logs.created_at`
- `sync_events.processed`, `sync_events.created_at`


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Password Hash Compatibility

*For any* password hash created by the Legacy_Backend using bcryptjs, the Django_Backend SHALL successfully verify the password using the same plaintext password.

**Validates: Requirements 3.1, 3.3**

### Property 2: Authentication Token Generation

*For any* valid username and password combination, authenticating through the Django_Backend SHALL return a valid JWT token that can be used for subsequent authenticated requests.

**Validates: Requirements 3.2, 3.4**

### Property 3: Role-Based Access Control

*For any* API endpoint with role restrictions, a user with insufficient role privileges SHALL receive an authorization error (403), while a user with appropriate role privileges SHALL be able to access the endpoint.

**Validates: Requirements 3.5, 28.18**

### Property 4: Token Invalidation on Logout

*For any* authenticated user, after calling the logout endpoint, the user's token SHALL no longer authenticate subsequent requests.

**Validates: Requirements 3.10**

### Property 5: Foreign Key Cascade Deletion

*For any* model with CASCADE foreign key relationships, deleting the parent record SHALL automatically delete all related child records.

**Validates: Requirements 2.4**

### Property 6: Foreign Key SET NULL Behavior

*For any* model with SET NULL foreign key relationships, deleting the parent record SHALL set the foreign key field to NULL in related child records without deleting them.

**Validates: Requirements 2.4**

### Property 7: Unique Constraint Enforcement

*For any* model field with a UNIQUE constraint (student_id, username, email), attempting to create a second record with the same value SHALL fail with a validation error.

**Validates: Requirements 2.6, 4.9**

### Property 8: Default Value Assignment

*For any* model field with a default value, creating a record without specifying that field SHALL result in the record having the default value.

**Validates: Requirements 2.7, 3.11, 8.9**

### Property 9: JSON Field Round-Trip

*For any* valid JSON data stored in a JSONB field (audit_logs.payload, sync_events.payload), retrieving the data SHALL return structurally equivalent JSON.

**Validates: Requirements 2.10**

### Property 10: Timestamp Auto-Generation

*For any* model with a created_at timestamp field, creating a record SHALL automatically set the timestamp to the current time without explicit specification.

**Validates: Requirements 2.12, 5.13, 8.10**

### Property 11: Soft Delete Preservation

*For any* cadet or staff record, calling the DELETE endpoint SHALL set is_archived=True rather than removing the record from the database, and the record SHALL no longer appear in default list endpoints.

**Validates: Requirements 4.5, 4.6**

### Property 12: Soft Delete Restoration

*For any* archived cadet, calling the restore endpoint SHALL set is_archived=False, and the cadet SHALL reappear in default list endpoints.

**Validates: Requirements 4.7**

### Property 13: Automatic Grades Creation

*For any* newly created cadet, a corresponding grades record SHALL be automatically created with default values (attendance_present=0, merit_points=0, demerit_points=0).

**Validates: Requirements 4.15**

### Property 14: Merit Points Accumulation

*For any* cadet, adding a merit log with N points SHALL increase the cadet's grades.merit_points by exactly N points.

**Validates: Requirements 5.8**

### Property 15: Demerit Points Accumulation

*For any* cadet, adding a demerit log with N points SHALL increase the cadet's grades.demerit_points by exactly N points.

**Validates: Requirements 5.9**

### Property 16: Attendance Count Increment

*For any* cadet, creating an attendance record with status='present' SHALL increment the cadet's grades.attendance_present by 1.

**Validates: Requirements 6.14**

### Property 17: Unique Attendance Constraint

*For any* training day and cadet combination, attempting to create a second attendance record SHALL fail with a uniqueness constraint error.

**Validates: Requirements 6.8**

### Property 18: Unique Staff Attendance Constraint

*For any* training day and staff combination, attempting to create a second staff attendance record SHALL fail with a uniqueness constraint error.

**Validates: Requirements 6.13**

### Property 19: Excuse Letter Approval Updates Attendance

*For any* excuse letter linked to an attendance record, approving the excuse letter (status='approved') SHALL update the corresponding attendance record status to 'excused'.

**Validates: Requirements 8.12**

### Property 20: Audit Log Creation on Data Modification

*For any* CREATE, UPDATE, or DELETE operation on tracked models (merit_demerit_logs, grades, cadets, etc.), an audit_logs entry SHALL be created recording the operation, table_name, record_id, and payload.

**Validates: Requirements 5.14, 19.1, 19.11**

### Property 21: Sync Event Creation on Grade Changes

*For any* modification to merit/demerit logs or grades, a sync_events entry SHALL be created with the appropriate event_type and cadet_id for real-time broadcasting.

**Validates: Requirements 5.15, 19.7**

### Property 22: Enum Field Validation

*For any* model field with enum constraints (User.role, AttendanceRecord.status, ExcuseLetter.status, MeritDemeritLog.type), attempting to create or update a record with an invalid value SHALL fail with a validation error.

**Validates: Requirements 2.5, 5.12, 6.9, 8.8**

### Property 23: Required Field Validation

*For any* model with required fields, attempting to create a record without providing all required fields SHALL fail with a validation error.

**Validates: Requirements 4.8, 8.6**

### Property 24: Positive Integer Validation

*For any* merit or demerit log, attempting to create a log with points ≤ 0 SHALL fail with a validation error.

**Validates: Requirements 5.11**

### Property 25: File Upload Returns URL

*For any* valid file upload (image or document), the upload endpoint SHALL return a Cloudinary URL that can be used to retrieve the file.

**Validates: Requirements 7.2, 7.7**

### Property 26: File Type Validation

*For any* file upload, attempting to upload a file with an unsupported file type SHALL fail with a validation error.

**Validates: Requirements 7.8**

### Property 27: File Size Validation

*For any* file upload, attempting to upload a file exceeding the maximum size limit SHALL fail with a validation error.

**Validates: Requirements 7.8**

### Property 28: Activity Image Record Creation

*For any* image uploaded for an activity, an activity_images record SHALL be created linking the image URL to the activity.

**Validates: Requirements 7.13**

### Property 29: Filtering Returns Matching Records Only

*For any* list endpoint with filtering support (cadets, attendance, excuse letters, etc.), applying a filter SHALL return only records where the filtered field matches the filter value.

**Validates: Requirements 4.10, 8.11**

### Property 30: Search Returns Matching Records

*For any* search query on cadets, the results SHALL include only cadets whose first_name, last_name, or student_id contains the search term (case-insensitive).

**Validates: Requirements 4.11**

### Property 31: Notification Creation on Message

*For any* new admin message or staff message, a notification SHALL be created for the intended recipient(s).

**Validates: Requirements 11.15**

### Property 32: Cache Invalidation on Update

*For any* cached entity (cadet, grade, training day, system setting), updating the entity SHALL invalidate the relevant cache entries, ensuring subsequent reads return fresh data.

**Validates: Requirements 15.6, 15.12, 15.13**

### Property 33: Cache Fallback on Unavailability

*For any* cached data request, if Redis is unavailable, the system SHALL fall back to querying the database directly without failing the request.

**Validates: Requirements 15.10**

### Property 34: Data Migration Preservation

*For any* record in the Legacy_Backend database, after migration to Django_Backend, the record SHALL exist with identical field values, preserving all data including timestamps, foreign key relationships, and Cloudinary URLs.

**Validates: Requirements 23.3, 23.6, 23.7, 23.8**

### Property 35: API Response Format Compatibility

*For any* API endpoint, the JSON response structure (field names, nesting, data types) SHALL match the Legacy_Backend response format to ensure frontend compatibility.

**Validates: Requirements 3.9, 4.12, 24.2, 24.5, 24.6, 24.7, 24.8, 24.9, 34.5-34.9**

### Property 36: CORS Headers Present

*For any* API response, the response SHALL include appropriate CORS headers allowing requests from the React_Frontend origin.

**Validates: Requirements 1.4, 24.3, 34.3**

### Property 37: Authentication Header Format

*For any* authenticated request, the system SHALL accept JWT tokens in the Authorization header using the same format as Legacy_Backend (e.g., "Bearer <token>").

**Validates: Requirements 24.7, 34.4**

### Property 38: HTTP Status Code Consistency

*For any* API endpoint, the HTTP status codes for success and error cases SHALL match those returned by Legacy_Backend (200 for success, 201 for creation, 400 for validation errors, 401 for authentication errors, 403 for authorization errors, 404 for not found, 500 for server errors).

**Validates: Requirements 24.3, 24.11**

### Property 39: Pagination Format Consistency

*For any* paginated list endpoint, the response SHALL include page, limit, and total fields in the same format as Legacy_Backend.

**Validates: Requirements 24.9**

### Property 40: Error Message Format Consistency

*For any* error response, the error message structure SHALL match Legacy_Backend format to ensure frontend error handling works correctly.

**Validates: Requirements 24.6, 29.11**

### Property 41: Input Validation and Sanitization

*For any* user input (form data, query parameters, file uploads), the system SHALL validate and sanitize the input to prevent injection attacks and invalid data.

**Validates: Requirements 28.8, 28.9, 28.14, 28.15**

### Property 42: Secure Password Hashing

*For any* new user registration or password change, the password SHALL be hashed using bcrypt with an appropriate work factor before storage, and the plaintext password SHALL never be stored.

**Validates: Requirements 28.10**

### Property 43: Error Logging

*For any* error or exception, the system SHALL log the error with timestamp, stack trace, and relevant context information.

**Validates: Requirements 29.2, 29.17**

### Property 44: Request Logging

*For any* API request, the system SHALL log the HTTP method, path, status code, and response time.

**Validates: Requirements 29.3**

### Property 45: Graceful Error Handling

*For any* database or Redis connection error, the system SHALL handle the error gracefully, return an appropriate error response to the client, and log the error without crashing.

**Validates: Requirements 29.14, 29.15**


## Error Handling

### Error Categories

**Validation Errors (400 Bad Request)**:
- Missing required fields
- Invalid field values (enum violations, type mismatches)
- Constraint violations (unique, check constraints)
- File upload errors (invalid type, size exceeded)

**Authentication Errors (401 Unauthorized)**:
- Missing or invalid JWT token
- Expired token
- Invalid credentials (login)

**Authorization Errors (403 Forbidden)**:
- Insufficient role privileges
- Unapproved user account
- Access to archived resources

**Not Found Errors (404 Not Found)**:
- Resource does not exist
- Invalid ID in URL path

**Conflict Errors (409 Conflict)**:
- Unique constraint violations
- Concurrent modification conflicts

**Server Errors (500 Internal Server Error)**:
- Database connection failures
- Redis connection failures
- Cloudinary upload failures
- Unhandled exceptions

### Error Response Format

All error responses follow a consistent JSON structure matching Legacy_Backend:

```json
{
  "error": true,
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error details"
  }
}
```

### Error Handling Strategy

**Input Validation**:
- Django REST Framework serializers validate all input data
- Custom validators for complex business rules
- Sanitization of user input to prevent injection attacks
- File upload validation (type, size, content)

**Database Error Handling**:
- Catch IntegrityError for constraint violations
- Catch OperationalError for connection issues
- Transaction rollback on errors
- Retry logic for transient failures

**External Service Error Handling**:
- Cloudinary upload failures → return error, don't save record
- Redis unavailable → fall back to database, log warning
- Celery task failures → retry with exponential backoff
- Push notification failures → log error, don't block request

**Logging Strategy**:
- All errors logged with full stack traces
- Structured logging in JSON format for parsing
- Log levels: DEBUG (development), INFO (production), WARNING (recoverable errors), ERROR (failures), CRITICAL (system failures)
- Separate log files for different components (api.log, celery.log, channels.log)
- Log rotation to prevent disk space issues

**User-Facing Error Messages**:
- Development mode: Detailed error messages with stack traces
- Production mode: Generic error messages, detailed logs server-side
- Validation errors: Specific field-level error messages
- Authentication/authorization errors: Clear guidance on required permissions

### Exception Handling Middleware

Custom Django middleware catches all unhandled exceptions:

```python
class ErrorHandlingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        try:
            response = self.get_response(request)
            return response
        except Exception as e:
            logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
            return JsonResponse({
                'error': True,
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }, status=500)
```

### Graceful Degradation

**Redis Unavailable**:
- Cache reads fall back to database
- Cache writes are skipped with warning log
- Celery tasks queue in memory (limited capacity)
- WebSocket falls back to polling

**Database Connection Issues**:
- Connection pooling with automatic reconnection
- Read replicas for failover (if configured)
- Graceful error messages to users
- Admin notifications for persistent issues

**Cloudinary Unavailable**:
- File uploads fail with clear error message
- Existing URLs continue to work (Cloudinary CDN)
- Retry mechanism for transient failures

