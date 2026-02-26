# API Differences: Node.js vs Django Backend

This document outlines the differences between the Node.js backend and the Django backend implementation, focusing on API compatibility and response formatting.

## Overview

The Django backend has been designed to maintain 100% API compatibility with the Node.js backend to ensure the React frontend works without modifications. This document highlights the standardization efforts and any minor differences.

## Response Format Standardization

### Success Responses

**Format:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Status Codes:**
- `200 OK` - Successful GET, PUT, PATCH, DELETE requests
- `201 Created` - Successful POST requests that create resources

### Error Responses

**Format:**
```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

**Status Codes:**
- `400 Bad Request` - Invalid request data or validation errors
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - HTTP method not supported
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server-side errors
- `503 Service Unavailable` - Temporary service issues (cache, database)

**Error Codes:**
- `BAD_REQUEST` - Invalid request data
- `UNAUTHORIZED` - Authentication issues
- `FORBIDDEN` - Permission denied
- `NOT_FOUND` - Resource not found
- `METHOD_NOT_ALLOWED` - Invalid HTTP method
- `CONFLICT` - Resource conflict
- `UNPROCESSABLE_ENTITY` - Semantic errors
- `TOO_MANY_REQUESTS` - Rate limiting
- `INTERNAL_SERVER_ERROR` - Server errors
- `SERVICE_UNAVAILABLE` - Temporary unavailability

### Pagination Responses

**Format:**
```json
{
  "page": 1,
  "limit": 50,
  "total": 100,
  "data": [ ... ]
}
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 1000)

## Date/Time Format

**Standard:** ISO 8601 format with milliseconds and UTC timezone

**Format:** `YYYY-MM-DDTHH:mm:ss.sssZ`

**Examples:**
- `2024-01-15T14:30:45.123Z`
- `2024-12-31T23:59:59.999Z`

**Implementation:**
- All datetime fields are serialized in ISO 8601 format
- Timezone is always UTC (Z suffix)
- Milliseconds are included for precision

## Boolean Representation

**Standard:** JSON boolean values (`true`/`false`)

**NOT:** Integer values (`1`/`0`)

**Examples:**
```json
{
  "is_active": true,
  "is_archived": false,
  "email_alerts": true
}
```

## API Versioning

### Current Version: v1

**Base URL:** `/api/v1/`

**Versioned Endpoints:**
- `/api/v1/auth/login`
- `/api/v1/cadets/`
- `/api/v1/grades/`
- etc.

**Legacy Support:**
For backward compatibility during migration, the following legacy paths are also supported:
- `/api/auth/login`
- `/api/cadets/`
- `/api/grades/`
- etc.

**Recommendation:** Use versioned endpoints (`/api/v1/`) for all new integrations.

## CORS Configuration

### Development
**Allowed Origins:**
- `http://localhost:3000`
- `http://localhost:5173`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`

### Production
**Allowed Origins:** Configured via `CORS_ALLOWED_ORIGINS` environment variable (comma-separated)

**Credentials:** Enabled (`CORS_ALLOW_CREDENTIALS = True`)

**Allowed Headers:**
- `accept`
- `accept-encoding`
- `authorization`
- `content-type`
- `dnt`
- `origin`
- `user-agent`
- `x-csrftoken`
- `x-requested-with`

## HTTP Status Code Consistency

The Django backend maintains the same HTTP status codes as the Node.js backend:

### Success Codes
- `200 OK` - Standard success response
- `201 Created` - Resource created successfully

### Client Error Codes
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required/failed
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found

### Server Error Codes
- `500 Internal Server Error` - Unexpected server error

## Key Differences

### 1. Authentication Token Format

**Node.js:** Custom token format
**Django:** JWT (JSON Web Token) format

**Impact:** Minimal - tokens are still passed in `Authorization: Bearer <token>` header

### 2. Database ORM

**Node.js:** Raw SQL queries with parameterization
**Django:** Django ORM with automatic query generation

**Impact:** None - API responses remain identical

### 3. File Upload Handling

**Node.js:** Multer middleware
**Django:** Django REST Framework file upload handling

**Impact:** None - same multipart/form-data format supported

### 4. Real-time Features

**Node.js:** Server-Sent Events (SSE) for real-time updates
**Django:** Django Channels with WebSocket support + SSE fallback

**Impact:** Enhanced - WebSocket provides better real-time capabilities

### 5. Background Tasks

**Node.js:** In-process task execution
**Django:** Celery distributed task queue

**Impact:** Improved - better scalability and reliability

## Migration Checklist

When migrating from Node.js to Django backend:

- [ ] Update API base URL to include `/api/v1/` prefix (recommended)
- [ ] Verify authentication token handling (JWT format)
- [ ] Test all API endpoints for response format consistency
- [ ] Verify date/time parsing (ISO 8601 format)
- [ ] Check boolean field handling (true/false not 1/0)
- [ ] Test pagination (page, limit, total, data fields)
- [ ] Verify error handling (error, message, code, details fields)
- [ ] Test file upload functionality
- [ ] Verify CORS configuration for your domain
- [ ] Test real-time features (WebSocket/SSE)

## Testing API Compatibility

### Using curl

**Success Response:**
```bash
curl -X GET http://localhost:8000/api/v1/cadets/ \
  -H "Authorization: Bearer <token>"
```

**Expected Response:**
```json
{
  "page": 1,
  "limit": 50,
  "total": 100,
  "data": [...]
}
```

**Error Response:**
```bash
curl -X GET http://localhost:8000/api/v1/cadets/999999 \
  -H "Authorization: Bearer <token>"
```

**Expected Response:**
```json
{
  "error": true,
  "message": "The requested resource was not found",
  "code": "NOT_FOUND",
  "details": {}
}
```

## Support

For questions or issues related to API compatibility:

1. Check this document for known differences
2. Review the API endpoint documentation in `API_ENDPOINTS.md`
3. Test the endpoint using the examples above
4. Report any inconsistencies to the development team

## Version History

- **v1.0** (2024) - Initial Django backend implementation with Node.js compatibility
  - Standardized response formats
  - ISO 8601 date/time format
  - Consistent error handling
  - API versioning support
  - CORS configuration
  - Pagination standardization
