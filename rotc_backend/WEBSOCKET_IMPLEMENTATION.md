# WebSocket Real-Time Updates Implementation

## Overview

This document describes the Django Channels implementation for real-time updates in the ROTC Grading System. The system supports WebSocket connections for instant updates and provides SSE (Server-Sent Events) fallback for backward compatibility.

## Architecture

### Components

1. **ASGI Application** (`config/asgi.py`)
   - Configured with ProtocolTypeRouter for HTTP and WebSocket protocols
   - Uses AllowedHostsOriginValidator for security
   - Routes WebSocket connections to appropriate consumers

2. **WebSocket Consumer** (`apps/messaging/consumers.py`)
   - `UpdatesConsumer`: Handles WebSocket connections with token-based authentication
   - Supports user-specific, role-specific, and cadet-specific groups
   - Implements error handling and message replay for reconnection

3. **Broadcasting Utilities** (`apps/messaging/websocket_utils.py`)
   - `broadcast_grade_update()`: Broadcasts grade changes
   - `broadcast_attendance_update()`: Broadcasts attendance changes
   - `broadcast_exam_score_update()`: Broadcasts exam score changes
   - `broadcast_notification()`: Broadcasts notifications to specific users
   - `broadcast_message()`: Broadcasts messages to multiple users
   - `broadcast_sync_event()`: Generic sync event broadcasting

4. **Sync Event Processor** (`apps/system/sync_processor.py`)
   - Processes unprocessed sync_events from the database
   - Broadcasts events via WebSocket
   - Includes cleanup function for old events

5. **SSE Endpoint** (`apps/system/views.py`)
   - `events_sse_view()`: Server-Sent Events endpoint at `/api/events`
   - Provides backward compatibility with SSE clients
   - Polls sync_events and streams to clients

## WebSocket Connection

### Endpoint

```
ws://localhost:8000/ws/updates/?token=<JWT_TOKEN>
```

### Authentication

WebSocket connections require JWT token authentication via query parameter:

```javascript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8000/ws/updates/?token=${token}`);
```

### Connection Flow

1. Client connects with JWT token in query string
2. Server validates token and authenticates user
3. User is added to appropriate groups:
   - Personal group: `user_{user_id}`
   - Role group: `role_{role}` (admin, cadet, training_staff)
   - Cadet group: `cadet_{cadet_id}` (for cadets only)
4. Server sends connection confirmation message

### Message Types

#### Client → Server

**Ping (Heartbeat)**
```json
{
  "type": "ping",
  "timestamp": 1234567890
}
```

**Replay Request (Reconnection)**
```json
{
  "type": "replay_request",
  "last_event_id": 123
}
```

#### Server → Client

**Connection Established**
```json
{
  "type": "connection_established",
  "message": "WebSocket connection established",
  "user_id": 1,
  "role": "cadet"
}
```

**Grade Update**
```json
{
  "type": "grade_update",
  "data": {
    "cadet_id": 1,
    "type": "merit",
    "points": 5,
    "merit_points": 25,
    "demerit_points": 10,
    "reason": "Outstanding performance",
    "attendance_present": 15,
    "prelim_score": 85.5,
    "midterm_score": 90.0,
    "final_score": null
  }
}
```

**Attendance Update**
```json
{
  "type": "attendance_update",
  "data": {
    "cadet_id": 1,
    "training_day_id": 5,
    "status": "present",
    "attendance_present": 16,
    "time_in": "08:00:00",
    "time_out": null
  }
}
```

**Exam Score Update**
```json
{
  "type": "exam_score_update",
  "data": {
    "cadet_id": 1,
    "prelim_score": 85.5,
    "midterm_score": 90.0,
    "final_score": 88.0,
    "changed_scores": {
      "final_score": 88.0
    }
  }
}
```

**Notification**
```json
{
  "type": "notification",
  "data": {
    "id": 123,
    "message": "New message from admin",
    "type": "admin_message",
    "is_read": false,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Pong (Heartbeat Response)**
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

**Error**
```json
{
  "type": "error",
  "message": "Error description"
}
```

## SSE Fallback

### Endpoint

```
GET /api/events
```

### Authentication

Requires JWT token in Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

### Usage

```javascript
const token = localStorage.getItem('access_token');
const eventSource = new EventSource(`/api/events`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};
```

### Event Format

SSE events follow the same format as WebSocket messages, with additional metadata:

```
id: 123
data: {"type": "grade_update", "cadet_id": 1, "data": {...}, "timestamp": "2024-01-15T10:30:00Z"}
```

## Broadcasting from Code

### Grade Updates

```python
from apps.messaging.websocket_utils import broadcast_grade_update

grade_data = {
    'type': 'merit',
    'points': 5,
    'merit_points': 25,
    'demerit_points': 10,
    'reason': 'Outstanding performance',
    'attendance_present': 15,
    'prelim_score': 85.5,
    'midterm_score': 90.0,
    'final_score': None,
}

broadcast_grade_update(cadet_id=1, grade_data=grade_data)
```

### Attendance Updates

```python
from apps.messaging.websocket_utils import broadcast_attendance_update

attendance_data = {
    'training_day_id': 5,
    'status': 'present',
    'attendance_present': 16,
    'time_in': '08:00:00',
    'time_out': None,
}

broadcast_attendance_update(cadet_id=1, attendance_data=attendance_data)
```

### Exam Score Updates

```python
from apps.messaging.websocket_utils import broadcast_exam_score_update

exam_data = {
    'prelim_score': 85.5,
    'midterm_score': 90.0,
    'final_score': 88.0,
    'changed_scores': {
        'final_score': 88.0
    }
}

broadcast_exam_score_update(cadet_id=1, exam_data=exam_data)
```

## Sync Events

### Creating Sync Events

Sync events are automatically created by Django signals when grades, attendance, or exam scores are updated. They can also be created manually:

```python
from apps.system.models import SyncEvent

SyncEvent.objects.create(
    event_type='grade_update',
    cadet_id=1,
    payload={
        'type': 'merit',
        'points': 5,
        'merit_points': 25,
        'demerit_points': 10,
    }
)
```

### Processing Sync Events

Sync events are processed by a Celery task that runs periodically:

```python
from apps.system.tasks import process_sync_events_task

# Run manually
process_sync_events_task.delay()
```

Or use the processor directly:

```python
from apps.system.sync_processor import process_sync_events

# Process up to 100 events
count = process_sync_events(batch_size=100)
```

## Configuration

### Channel Layers

**Development** (In-Memory):
```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}
```

**Production** (Redis):
```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
            'capacity': 1500,
            'expiry': 10,
        },
    },
}
```

### Running the Server

**Development**:
```bash
python manage.py runserver
```

**Production** (with Daphne):
```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## Error Handling

### Connection Errors

- **4000**: Internal server error during connection
- **4001**: Authentication failed (no token or invalid token)

### Reconnection

Clients should implement automatic reconnection with exponential backoff:

```javascript
let reconnectDelay = 1000;
const maxReconnectDelay = 30000;

function connect() {
  const ws = new WebSocket(`ws://localhost:8000/ws/updates/?token=${token}`);
  
  ws.onopen = () => {
    console.log('Connected');
    reconnectDelay = 1000; // Reset delay on successful connection
  };
  
  ws.onclose = () => {
    console.log('Disconnected, reconnecting...');
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}
```

### Message Replay

After reconnection, clients can request missed events:

```javascript
ws.send(JSON.stringify({
  type: 'replay_request',
  last_event_id: lastReceivedEventId
}));
```

## Testing

### Manual Testing with wscat

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:8000/ws/updates/?token=YOUR_JWT_TOKEN"

# Send ping
> {"type": "ping", "timestamp": 1234567890}

# Request replay
> {"type": "replay_request", "last_event_id": 0}
```

### Testing SSE

```bash
curl -N -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:8000/api/events
```

## Monitoring

### Celery Tasks

Monitor sync event processing:

```bash
celery -A config worker -l info
```

### Logs

WebSocket connections and errors are logged:

```python
import logging
logger = logging.getLogger('apps.messaging.consumers')
```

## Security Considerations

1. **Token Authentication**: All WebSocket connections require valid JWT tokens
2. **User Approval**: Only approved users can connect
3. **Group Isolation**: Users only receive events relevant to their role and cadet_id
4. **Origin Validation**: AllowedHostsOriginValidator prevents unauthorized origins
5. **Rate Limiting**: Consider implementing rate limiting for WebSocket messages

## Performance

- **Channel Layer**: Use Redis in production for better performance
- **Batch Processing**: Sync events are processed in batches of 100
- **Event Cleanup**: Old processed events are cleaned up after 7 days
- **Connection Limits**: Monitor concurrent WebSocket connections

## Troubleshooting

### WebSocket Connection Fails

1. Check JWT token is valid and not expired
2. Verify user is approved (`is_approved=True`)
3. Check ALLOWED_HOSTS includes the WebSocket origin
4. Verify Redis is running (production)

### Events Not Broadcasting

1. Check channel layer configuration
2. Verify signals are registered in apps.py
3. Check sync_events are being created
4. Monitor Celery worker logs

### SSE Connection Drops

1. Check server timeout settings
2. Verify client handles reconnection
3. Monitor server resources (memory, CPU)
