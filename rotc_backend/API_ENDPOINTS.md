# ROTC Backend API Endpoints

## Authentication Endpoints

### POST /api/auth/login
Login with username and password, returns JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "is_approved": true,
    ...
  },
  "role": "admin"
}
```

### POST /api/auth/register
Register a new user (requires approval).

**Request:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "role": "cadet"
}
```

**Response:**
```json
{
  "user": {...},
  "is_approved": false,
  "message": "Registration successful. Awaiting approval."
}
```

### POST /api/auth/logout
Logout and invalidate refresh token.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### GET /api/auth/profile
Get current user profile with related data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "is_approved": true,
  "cadet": {...},
  "staff": {...},
  "settings": {...}
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

## Cadet Management Endpoints

### GET /api/cadets/
List all non-archived cadets with filtering and search.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `company` - Filter by company
- `platoon` - Filter by platoon
- `course` - Filter by course
- `year_level` - Filter by year level
- `status` - Filter by status
- `search` - Search by name or student_id
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "student_id": "2024-001",
      "first_name": "John",
      "last_name": "Doe",
      "company": "Alpha",
      "platoon": "1st",
      "grades": {
        "attendance_present": 10,
        "merit_points": 50,
        "demerit_points": 5,
        ...
      },
      ...
    }
  ],
  "page": 1,
  "limit": 50,
  "total": 100
}
```

### POST /api/cadets/
Create a new cadet (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "student_id": "2024-001",
  "first_name": "John",
  "last_name": "Doe",
  "company": "Alpha",
  "platoon": "1st",
  "course": "BSCS",
  "year_level": 3
}
```

**Response:** Returns created cadet with auto-generated grades.

### GET /api/cadets/{id}
Get a single cadet with grades.

**Headers:** `Authorization: Bearer <token>`

### PUT /api/cadets/{id}
Update a cadet (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request:** Partial update supported.

### DELETE /api/cadets/{id}
Soft delete a cadet (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "message": "Cadet archived successfully",
  "is_archived": true
}
```

### GET /api/cadets/archived
List archived cadets (Admin only).

**Headers:** `Authorization: Bearer <token>`

### POST /api/cadets/{id}/restore
Restore an archived cadet (Admin only).

**Headers:** `Authorization: Bearer <token>`

---

## Grading System Endpoints

### GET /api/grades/
Get all grades with cadet information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "id": 1,
    "cadet": 1,
    "cadet_info": {
      "id": 1,
      "student_id": "2024-001",
      "first_name": "John",
      "last_name": "Doe",
      "company": "Alpha",
      "platoon": "1st"
    },
    "attendance_present": 10,
    "merit_points": 50,
    "demerit_points": 5,
    "prelim_score": 85.5,
    "midterm_score": 90.0,
    "final_score": 88.0,
    "merit_demerit_logs": [...]
  }
]
```

### GET /api/grades/{cadet_id}
Get grades for a specific cadet with merit/demerit history.

**Headers:** `Authorization: Bearer <token>`

### PUT /api/grades/{cadet_id}
Update grades for a specific cadet (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "attendance_present": 15,
  "merit_points": 60,
  "demerit_points": 5,
  "prelim_score": 85.5,
  "midterm_score": 90.0,
  "final_score": 88.0
}
```

---

## Merit/Demerit System Endpoints

### POST /api/merit-demerit/
Create a new merit/demerit log entry (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "cadet": 1,
  "type": "merit",
  "points": 10,
  "reason": "Excellent performance in drill",
  "issued_by_user_id": 1,
  "issued_by_name": "Admin User"
}
```

**Response:** Returns created log entry. Automatically updates cadet's grades.

### GET /api/merit-demerit/{cadet_id}
Get merit/demerit history for a specific cadet.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "id": 1,
    "cadet": 1,
    "cadet_name": "John Doe",
    "type": "merit",
    "points": 10,
    "reason": "Excellent performance in drill",
    "issued_by_user_id": 1,
    "issued_by_name": "Admin User",
    "date_recorded": "2024-01-15T10:30:00Z"
  }
]
```

### DELETE /api/merit-demerit/delete/{log_id}
Delete a merit/demerit log entry (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Response:** Automatically reverts the grade changes.

---

## Features Implemented

### ✅ Authentication System
- Bcrypt password hashing compatible with Node.js bcryptjs
- JWT token authentication with access and refresh tokens
- Role-based permissions (Admin, Cadet, Training Staff)
- User registration with approval workflow
- Profile management

### ✅ Cadet Management
- Full CRUD operations for cadets
- Soft delete (archiving) functionality
- Filtering by company, platoon, course, year level, status
- Search by name or student ID
- Pagination support
- Automatic grades creation on cadet creation

### ✅ Grading System
- Grade tracking (attendance, merit/demerit points, exam scores)
- Merit/demerit log management
- Automatic grade updates via Django signals
- Audit logging for all grade changes
- Sync events for real-time updates

### ✅ Audit & Sync
- Comprehensive audit logging for all data modifications
- Sync events for real-time update broadcasting
- Automatic tracking of user actions

---

## Testing

Run the test script to verify all functionality:

```bash
python test_api.py
```

This will test:
- User creation with bcrypt password hashing
- Cadet creation with automatic grades
- Merit/demerit system with automatic grade updates
- Audit log creation
- Sync event creation

---

## Next Steps

The following features are ready for implementation:
- Attendance tracking system
- Activities and achievements management
- Training staff management
- Messaging and notifications
- File uploads (Cloudinary integration)
- Real-time updates (Django Channels)
- Background tasks (Celery)
- Caching (Redis)
