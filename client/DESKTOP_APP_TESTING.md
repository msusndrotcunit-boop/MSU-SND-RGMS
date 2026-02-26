# Desktop App Compatibility Testing Guide

## Overview

The ROTC Grading System desktop app is built using Electron, wrapping the same React frontend used for web and mobile. This guide covers testing the desktop app with the Django backend.

## Desktop App Architecture

**Technology Stack:**
- Framework: Electron 40.1.0
- Base: React 18.2.0 frontend
- Backend: Django REST API
- Platform: Windows, macOS, Linux

## Key Testing Areas

### 1. API Compatibility
- All REST API endpoints work from desktop app
- Same as web app testing (see FRONTEND_INTEGRATION_TESTS.md)
- CORS not an issue (Electron uses file:// protocol)

### 2. Authentication
- Login/logout functionality
- Token persistence in Electron storage
- Session management

### 3. Desktop-Specific Features
- Window management (minimize, maximize, close)
- System tray integration (if implemented)
- Native notifications
- File system access
- Auto-updates (if implemented)

### 4. Performance
- Fast app launch
- Responsive UI
- Memory usage
- CPU usage

## Testing Procedure

### Build Desktop App
```bash
cd client
npm run electron:build
```

### Run Desktop App
```bash
npm run electron
```

### Test All Features
Follow the same test procedures as web app (FRONTEND_INTEGRATION_TESTS.md) with these additions:

**Desktop-Specific Tests:**
- [ ] App launches correctly
- [ ] Window controls work (minimize, maximize, close)
- [ ] App icon displays correctly
- [ ] Native menus work (if implemented)
- [ ] File dialogs work for uploads
- [ ] Native notifications work
- [ ] App updates work (if implemented)

## Configuration

Update `client/electron/main.js` to point to Django backend:
```javascript
const API_URL = 'https://rotc-django-web.onrender.com';
```

## Requirements Covered

- Requirement 32.1: API compatibility with desktop app
- Requirement 32.2: Desktop app functionality

## Conclusion

The desktop app uses the same React frontend as the web app, so most testing procedures are identical. Focus on desktop-specific features like window management, native notifications, and file system access.

For detailed web app testing procedures, see `FRONTEND_INTEGRATION_TESTS.md`.
