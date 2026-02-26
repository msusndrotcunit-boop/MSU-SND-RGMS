# Celery Background Task Processing Implementation

## Overview

This document describes the Celery implementation for the ROTC Grading System Django backend. Celery provides asynchronous task processing for long-running operations, ensuring API responses remain fast and the system stays responsive.

## Architecture

### Components

1. **Celery App** (`config/celery.py`): Main Celery application configuration
2. **Redis Broker**: Message broker for task queue
3. **Redis Result Backend**: Stores task results
4. **Celery Workers**: Process background tasks
5. **Celery Beat**: Scheduler for periodic tasks

### Configuration

#### Celery Settings (config/settings/base.py)

```python
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
```

#### Retry Configuration

All tasks are configured with:
- **Max Retries**: 3 attempts
- **Retry Delay**: 60 seconds (default)
- **Exponential Backoff**: Enabled
- **Max Backoff**: 600 seconds (10 minutes)
- **Jitter**: Enabled to prevent thundering herd

## Background Tasks

### 1. Image Processing Tasks (apps/files/tasks.py)

#### compress_and_upload_image
Compresses images and uploads them to Cloudinary.

**Parameters:**
- `image_data`: Image file data or path
- `entity_type`: Type (profile_pic, activity_image, excuse_letter)
- `entity_id`: Entity ID
- `max_size`: Maximum dimensions (default: 1920x1080)
- `quality`: JPEG quality (default: 85)

**Returns:** Cloudinary upload result with URL and metadata

**Usage:**
```python
from apps.files.tasks import compress_and_upload_image

result = compress_and_upload_image.delay(
    image_data,
    'profile_pic',
    cadet_id
)
```

#### delete_cloudinary_image
Deletes an image from Cloudinary.

**Parameters:**
- `public_id`: Cloudinary public ID

#### batch_compress_images
Compresses multiple images in batch.

**Parameters:**
- `image_list`: List of dicts with image_data, entity_type, entity_id

### 2. PDF Generation Tasks (apps/system/tasks.py)

#### generate_pdf_report
Generates PDF reports using ReportLab.

**Parameters:**
- `report_type`: Type (cadet_profile, grades, attendance, certificate)
- `filters`: Dictionary of filters
- `user_id`: Requesting user ID

**Returns:** Cloudinary URL of generated PDF

**Supported Report Types:**
- `cadet_profile`: Individual cadet profile with grades
- `grades`: Grade summary for multiple cadets
- `attendance`: Attendance statistics
- `certificate`: Achievement certificate

**Usage:**
```python
from apps.system.tasks import generate_pdf_report

result = generate_pdf_report.delay(
    'grades',
    {'company': 'Alpha', 'platoon': '1st'},
    user_id
)
```

### 3. OCR Processing Tasks (apps/files/tasks.py)

#### process_ocr_document
Processes OCR on uploaded documents using pytesseract.

**Parameters:**
- `file_url`: URL of document to process
- `excuse_letter_id`: Excuse letter ID

**Returns:** Extracted text and metadata

**Usage:**
```python
from apps.files.tasks import process_ocr_document

result = process_ocr_document.delay(
    file_url,
    excuse_letter_id
)
```

### 4. Bulk Import Tasks (apps/system/tasks.py)

#### import_rotcmis_data
Imports cadet data from ROTCMIS JSON format.

**Parameters:**
- `json_data`: List of cadet data dictionaries
- `user_id`: User who initiated import

**Returns:** Import results with success/failure counts

**Usage:**
```python
from apps.system.tasks import import_rotcmis_data

result = import_rotcmis_data.delay(
    cadet_data_list,
    user_id
)
```

#### bulk_update_cadets
Performs bulk updates on cadet records.

**Parameters:**
- `updates_data`: List of dicts with cadet_id and fields to update
- `user_id`: User who initiated update

### 5. Email Notification Tasks (apps/messaging/tasks.py)

#### send_email_notification
Sends email notifications via SMTP.

**Parameters:**
- `recipient_email`: Recipient email address
- `subject`: Email subject
- `message`: Plain text message
- `html_message`: Optional HTML version
- `from_email`: Optional sender email

**Usage:**
```python
from apps.messaging.tasks import send_email_notification

result = send_email_notification.delay(
    'cadet@example.com',
    'Grade Update',
    'Your grade has been updated.'
)
```

#### send_bulk_email_notifications
Sends emails to multiple recipients.

#### send_grade_update_email
Sends email when cadet's grade is updated.

#### send_excuse_letter_status_email
Sends email when excuse letter status changes.

### 6. Push Notification Tasks (apps/messaging/tasks.py)

#### send_push_notification
Sends push notification to a specific user.

**Parameters:**
- `user_id`: User ID
- `title`: Notification title
- `message`: Notification message
- `data`: Optional additional data

#### send_push_notifications
Sends push notifications to multiple users.

#### send_broadcast_push_notification
Broadcasts push notification to all users or specific role.

**Parameters:**
- `title`: Notification title
- `message`: Notification message
- `role`: Optional role filter (admin, cadet, training_staff)

## Periodic Tasks (Celery Beat)

Configured in `config/celery.py`:

### 1. cleanup_old_notifications
- **Schedule**: Daily at 2:00 AM
- **Purpose**: Removes read notifications older than 30 days
- **Task**: `apps.messaging.tasks.cleanup_old_notifications`

### 2. cleanup_old_audit_logs
- **Schedule**: Daily at 3:00 AM
- **Purpose**: Removes audit logs older than 90 days
- **Task**: `apps.system.tasks.cleanup_old_audit_logs`

### 3. generate_daily_attendance_report
- **Schedule**: Daily at 6:00 PM
- **Purpose**: Generates daily attendance summary
- **Task**: `apps.attendance.tasks.generate_daily_attendance_report`

## Task Monitoring

### API Endpoints

#### GET /api/tasks/:task_id/status
Get the status of a Celery task.

**Response:**
```json
{
  "task_id": "abc123",
  "status": "SUCCESS",
  "ready": true,
  "successful": true,
  "result": {...}
}
```

**Task States:**
- `PENDING`: Task is waiting to be executed
- `STARTED`: Task has been started
- `SUCCESS`: Task completed successfully
- `FAILURE`: Task failed
- `RETRY`: Task is being retried

#### GET /api/celery/health
Check Celery worker health status (Admin only).

**Response:**
```json
{
  "overall": "healthy",
  "celery": "healthy",
  "redis": "healthy",
  "workers": ["celery@worker1"],
  "queues": ["celery"]
}
```

#### GET /api/celery/stats
Get Celery task statistics (Admin only).

**Response:**
```json
{
  "total_tasks_24h": 150,
  "successful_tasks_24h": 145,
  "failed_tasks_24h": 5,
  "pending_tasks_24h": 0,
  "workers": {...},
  "active_tasks": {...}
}
```

#### POST /api/tasks/:task_id/revoke
Revoke (cancel) a running task (Admin only).

**Request:**
```json
{
  "terminate": false
}
```

## Task Failure Handling

### Automatic Notifications

When a task fails after all retries, admins are automatically notified:

1. Task failure signal is triggered
2. Notification is created for all admin users
3. Notification includes task name and error message

### Retry Logic

All tasks implement exponential backoff retry:

```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def my_task(self, ...):
    try:
        # Task logic
        pass
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

**Retry Schedule:**
- 1st retry: 60 seconds
- 2nd retry: 120 seconds
- 3rd retry: 240 seconds
- After 3 retries: Task fails, admins notified

## Running Celery

### Development

Start Celery worker:
```bash
celery -A config worker -l info
```

Start Celery Beat (for periodic tasks):
```bash
celery -A config beat -l info
```

### Production

Use supervisor or systemd to manage Celery processes:

**Celery Worker:**
```bash
celery -A config worker -l info --concurrency=4
```

**Celery Beat:**
```bash
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### Monitoring

Use Flower for real-time monitoring:
```bash
pip install flower
celery -A config flower
```

Access at: http://localhost:5555

## Environment Variables

Required environment variables:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Email Configuration (for email tasks)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@rotc.edu

# Cloudinary Configuration (for image/PDF tasks)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Best Practices

### 1. Task Design
- Keep tasks idempotent (can be run multiple times safely)
- Use `bind=True` for retry logic
- Set appropriate time limits
- Log task execution for debugging

### 2. Error Handling
- Always implement retry logic
- Catch specific exceptions
- Log errors with context
- Notify admins on critical failures

### 3. Performance
- Use batch operations for multiple items
- Set appropriate concurrency levels
- Monitor task execution times
- Use task priorities for critical tasks

### 4. Testing
- Test tasks synchronously in development
- Mock external services (Cloudinary, SMTP)
- Test retry logic
- Verify task results

## Troubleshooting

### Tasks Not Executing

1. Check Redis connection:
```bash
redis-cli ping
```

2. Check Celery worker is running:
```bash
celery -A config inspect active
```

3. Check task queue:
```bash
celery -A config inspect reserved
```

### Tasks Failing

1. Check worker logs for errors
2. Verify environment variables are set
3. Check external service connectivity (Cloudinary, SMTP)
4. Review task retry history in Django admin

### Performance Issues

1. Monitor task execution times
2. Adjust worker concurrency
3. Use task priorities
4. Implement task result expiration
5. Clean up old task results regularly

## Security Considerations

1. **Task Authentication**: Tasks that modify data should verify user permissions
2. **Input Validation**: Validate all task parameters
3. **Rate Limiting**: Implement rate limiting for user-triggered tasks
4. **Sensitive Data**: Don't log sensitive information (passwords, tokens)
5. **Admin Endpoints**: Restrict task management endpoints to admins only

## Future Enhancements

1. **Task Priorities**: Implement priority queues for critical tasks
2. **Task Chaining**: Chain related tasks (e.g., compress → upload → notify)
3. **Task Groups**: Execute multiple tasks in parallel
4. **Custom Schedulers**: Implement dynamic scheduling based on system load
5. **Monitoring Dashboard**: Build custom monitoring UI in Django admin
