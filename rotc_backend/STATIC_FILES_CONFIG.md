# Static Files Configuration for Production

## Overview

This document describes the static file serving configuration for the ROTC Django backend in production on Render.com.

## Configuration

### Django Settings

The following settings are configured in `config/settings/production.py`:

```python
# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Additional locations of static files
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# Static files storage
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'
```

### Build Process

During deployment on Render.com, static files are collected using:

```bash
python manage.py collectstatic --noinput
```

This command:
1. Collects all static files from apps and STATICFILES_DIRS
2. Copies them to STATIC_ROOT (staticfiles/ directory)
3. Makes them available for serving

### Serving Static Files

#### Option 1: WhiteNoise (Recommended for Django)

Install WhiteNoise for efficient static file serving:

```bash
pip install whitenoise
```

Update `config/settings/production.py`:

```python
# Add WhiteNoise middleware (after SecurityMiddleware)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add this
    # ... other middleware
]

# Use WhiteNoise storage with compression and caching
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

Benefits:
- Serves static files directly from Django
- Automatic compression (gzip/brotli)
- Far-future cache headers
- No separate web server needed

#### Option 2: Nginx Reverse Proxy

If using Nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /static/ {
        alias /path/to/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### React Frontend Integration

To serve the React frontend build from Django:

1. Build the React app:
```bash
cd client
npm run build
```

2. Copy build files to Django static directory:
```bash
cp -r client/dist/* rotc_backend/static/
```

3. Configure Django to serve index.html:

```python
# config/urls.py
from django.views.generic import TemplateView
from django.urls import path, re_path

urlpatterns = [
    # API endpoints
    path('api/', include('apps.api.urls')),
    
    # Serve React app for all other routes
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
]
```

4. Create template directory structure:
```
rotc_backend/
  templates/
    index.html  # Copy from React build
```

### Environment Variables

Required environment variables for production:

```bash
# Static files
STATIC_URL=/static/
STATIC_ROOT=/app/staticfiles

# If using CDN
STATIC_HOST=https://cdn.example.com
```

### Render.com Specific Configuration

The `render.yaml` includes static file collection in the build command:

```yaml
services:
  - type: web
    name: rotc-django-web
    buildCommand: |
      pip install --upgrade pip
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
      python manage.py migrate --noinput
```

### Troubleshooting

#### Static files not loading

1. Check STATIC_ROOT is set correctly
2. Verify collectstatic ran successfully
3. Check STATIC_URL matches your URL structure
4. Ensure WhiteNoise middleware is in correct position

#### 404 errors for static files

1. Run collectstatic manually:
```bash
python manage.py collectstatic --noinput
```

2. Check file permissions:
```bash
ls -la staticfiles/
```

3. Verify STATICFILES_DIRS paths exist

#### React app not loading

1. Ensure index.html is in templates directory
2. Check TEMPLATES setting includes templates directory
3. Verify static files are collected from React build
4. Check browser console for 404 errors

### Best Practices

1. **Use WhiteNoise** for simple deployments
2. **Enable compression** for faster loading
3. **Set far-future cache headers** for static assets
4. **Use CDN** for high-traffic applications
5. **Separate static and media files** (use Cloudinary for media)
6. **Version static files** using ManifestStaticFilesStorage
7. **Test locally** before deploying:
```bash
DEBUG=False python manage.py runserver --insecure
```

### Production Checklist

- [ ] STATIC_ROOT configured
- [ ] STATIC_URL configured
- [ ] collectstatic runs in build process
- [ ] WhiteNoise installed and configured
- [ ] Static files accessible at /static/
- [ ] React build files copied to static directory
- [ ] Cache headers configured
- [ ] Compression enabled
- [ ] 404 handling for SPA routes
- [ ] HTTPS enforced for static files

## References

- [Django Static Files Documentation](https://docs.djangoproject.com/en/5.0/howto/static-files/)
- [WhiteNoise Documentation](http://whitenoise.evans.io/)
- [Render.com Static Files Guide](https://render.com/docs/deploy-django)
