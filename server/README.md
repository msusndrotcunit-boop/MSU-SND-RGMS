# ROTC Grading System - Server

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Edit the `.env` file and configure the following:

```env
# Authentication Settings
# IMPORTANT: Set to false in production to enable proper authentication
BYPASS_AUTH=false
API_TOKEN=dev-token
DEFAULT_ROLE=admin

# Database (optional - uses SQLite by default)
# DATABASE_URL=postgresql://user:password@host:port/database
# SUPABASE_URL=your_supabase_connection_string

# Cloudinary (optional - for image uploads)
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

# VAPID Keys for Push Notifications (optional)
# VAPID_PUBLIC_KEY=your_public_key
# VAPID_PRIVATE_KEY=your_private_key

# Server Settings
PORT=5000
NODE_ENV=development
```

### 3. Start the Server

```bash
npm start
```

The server will run on `http://localhost:5000` by default.

## Authentication

The system uses a simple token-based authentication with in-memory sessions.

### Important Notes:

1. **BYPASS_AUTH**: When set to `true`, authentication is bypassed and a default user is used. This is useful for testing but should be `false` in production.

2. **API_TOKEN**: A shared token used for authentication. In production, consider implementing JWT or a more secure token system.

3. **Sessions**: Currently stored in-memory. For production, consider using Redis or a database-backed session store.

## API Endpoints

### Authentication
- `POST /api/auth/cadet-login` - Cadet login
- `POST /api/auth/staff-login-no-pass` - Staff login
- `POST /api/auth/admin-login` - Admin login

### Cadet Endpoints
- `GET /api/cadet/profile` - Get cadet profile
- `PUT /api/cadet/profile` - Update cadet profile
- `GET /api/cadet/my-grades` - Get cadet grades
- `GET /api/cadet/my-merit-logs` - Get merit/demerit logs

### Attendance
- `GET /api/attendance/my-history` - Get attendance history
- `GET /api/attendance/events` - SSE endpoint for real-time updates

## Troubleshooting

### 401/403 Errors After Login

If you're getting 401 or 403 errors after logging in, check the following:

1. Ensure `BYPASS_AUTH=false` in your `.env` file
2. Restart the server after changing environment variables
3. Clear browser localStorage and try logging in again
4. Check server logs for authentication errors

### Profile Shows as Verified but Asks to Complete

This can happen if:
1. The `is_profile_completed` field in the database is `1` but the session has stale data
2. The authentication token is not being sent correctly

To fix:
1. Log out and log back in
2. Check that the Authorization header is being sent with requests
3. Verify the token in localStorage matches the server's expected token

## Development

### Running Tests
```bash
npm test
```

### Database
The system uses SQLite by default. The database file is created at `server/database.db`.

To use PostgreSQL instead, set the `DATABASE_URL` environment variable.
