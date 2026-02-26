# Django Backend Configuration Guide

This document explains how the React frontend has been configured to connect to the Django backend.

## Configuration Files

### Environment Files

Three environment files have been created to manage API configuration:

1. **`.env.development`** - Used during local development
   - Django API URL: `http://localhost:8000`
   - WebSocket URL: `ws://localhost:8000`

2. **`.env.production`** - Used for production builds
   - Django API URL: `https://rotc-django-web.onrender.com`
   - WebSocket URL: `wss://rotc-django-channels.onrender.com`

3. **`.env.example`** - Template file for reference

### How It Works

The React app uses Vite's environment variable system:
- Variables prefixed with `VITE_` are exposed to the client-side code
- The `VITE_API_URL` variable is set in `src/main.jsx` as the axios base URL
- All API requests automatically use this base URL

## API Configuration

### Base URL Setup

In `src/main.jsx`:
```javascript
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
```

This means:
- In development: All API calls go to `http://localhost:8000`
- In production: All API calls go to `https://rotc-django-web.onrender.com`

### Authentication Token Format

The frontend uses JWT Bearer token authentication, which is **fully compatible** with Django's JWT implementation:

1. **Token Storage**: Tokens are stored in `localStorage` with key `'token'`
2. **Token Format**: `Bearer <token>` in the Authorization header
3. **Token Setting**: Set in `AuthContext.jsx`:
   ```javascript
   axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
   ```

### Django Backend JWT Configuration

The Django backend is configured to accept the same JWT format:
- Uses `djangorestframework-simplejwt` package
- Token lifetime: 24 hours (access token), 7 days (refresh token)
- Authentication header: `Authorization: Bearer <token>`
- Token claim: `user_id` field contains the user ID

## CORS Configuration

### Django Backend CORS Settings

The Django backend (`rotc_backend/config/settings/production.py`) is configured with:

```python
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
```

### Required Environment Variables

On the Django backend (Render.com), set:
```
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

This allows the React frontend to make cross-origin requests to the Django API.

## Real-Time Updates

### Current Implementation

The Node.js backend uses Server-Sent Events (SSE) for real-time updates. The Django backend implements this using:

1. **Django Channels** - WebSocket support for real-time communication
2. **Redis Channel Layer** - Message distribution across multiple server instances
3. **WebSocket Endpoint**: `/ws/updates/`

### Migration Notes

The frontend currently doesn't have active WebSocket connections in the codebase. Real-time features may be:
- Implemented via polling
- Using SSE (Server-Sent Events)
- Or not yet implemented

If real-time updates are needed, the frontend will need to:
1. Connect to the Django Channels WebSocket endpoint
2. Authenticate using the JWT token in the connection URL or initial message
3. Listen for grade updates, notifications, and messages

## Testing the Configuration

### 1. Local Development Testing

Start the Django backend:
```bash
cd rotc_backend
python manage.py runserver
```

Start the React frontend:
```bash
cd client
npm run dev
```

The frontend will connect to `http://localhost:8000` automatically.

### 2. Production Testing

After deploying the Django backend to Render.com:

1. Update `.env.production` with the actual Render.com URLs
2. Build the React app: `npm run build`
3. Deploy the built files to your hosting service
4. Test authentication and API calls

### 3. CORS Testing

To verify CORS is working:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Login to the application
4. Check the API requests:
   - Should see `Authorization: Bearer <token>` header
   - Should NOT see CORS errors in console
   - Response headers should include `Access-Control-Allow-Origin`

## API Compatibility

### Endpoint Compatibility

The Django backend maintains API compatibility with the Node.js backend:

| Feature | Node.js Endpoint | Django Endpoint | Status |
|---------|-----------------|-----------------|--------|
| Login | POST /api/auth/login | POST /api/auth/login | ✅ Compatible |
| Register | POST /api/auth/register | POST /api/auth/register | ✅ Compatible |
| Profile | GET /api/auth/profile | GET /api/auth/profile | ✅ Compatible |
| Cadets List | GET /api/cadets | GET /api/cadets | ✅ Compatible |
| Grades | GET /api/grades/:id | GET /api/grades/:id | ✅ Compatible |
| Attendance | GET /api/attendance | GET /api/attendance | ✅ Compatible |
| Activities | GET /api/activities | GET /api/activities | ✅ Compatible |
| Messages | GET /api/messages | GET /api/messages | ✅ Compatible |
| Notifications | GET /api/notifications | GET /api/notifications | ✅ Compatible |

### Response Format Compatibility

The Django backend uses a custom renderer (`NodeJSCompatibleRenderer`) to ensure response formats match the Node.js backend:

- Success responses: `{ data: {...}, status: 200 }`
- Error responses: `{ message: "...", error: "..." }`
- Pagination: `{ data: [...], page: 1, limit: 50, total: 100 }`

## Troubleshooting

### Issue: API calls fail with CORS errors

**Solution**: Ensure `CORS_ALLOWED_ORIGINS` is set correctly on the Django backend with your frontend domain.

### Issue: Authentication fails

**Solution**: 
1. Check that the token is stored in localStorage
2. Verify the Authorization header is set: `Bearer <token>`
3. Check Django backend logs for authentication errors

### Issue: 404 errors on API endpoints

**Solution**:
1. Verify `VITE_API_URL` is set correctly in the environment file
2. Check that the Django backend is running
3. Verify the endpoint exists in Django's URL configuration

### Issue: Token expires too quickly

**Solution**: Adjust `ACCESS_TOKEN_LIFETIME` in Django settings:
```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),  # Increase if needed
}
```

## Deployment Checklist

Before deploying to production:

- [ ] Update `.env.production` with actual Django backend URLs
- [ ] Set `CORS_ALLOWED_ORIGINS` on Django backend with frontend domain
- [ ] Set `ALLOWED_HOSTS` on Django backend with backend domain
- [ ] Test authentication flow end-to-end
- [ ] Test file uploads (profile pictures, excuse letters)
- [ ] Test real-time updates (if implemented)
- [ ] Verify HTTPS is working (SSL certificates)
- [ ] Test on mobile devices (Android app via Capacitor)
- [ ] Monitor Django backend logs for errors

## Next Steps

1. **Deploy Django Backend**: Follow `DEPLOYMENT_GUIDE.md` in `rotc_backend/`
2. **Update Frontend URLs**: Update `.env.production` with actual Render.com URLs
3. **Build Frontend**: Run `npm run build` in the client directory
4. **Deploy Frontend**: Deploy the `dist/` folder to your hosting service
5. **Test Integration**: Verify all features work with the Django backend

## Support

For issues or questions:
1. Check Django backend logs: `rotc_backend/logs/`
2. Check browser console for frontend errors
3. Review API responses in Network tab
4. Consult the migration spec: `.kiro/specs/nodejs-to-django-migration/`
