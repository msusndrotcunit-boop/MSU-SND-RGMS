# ROTC Django Backend - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the ROTC Django backend to Render.com, including staging and production environments.

## Prerequisites

- [ ] Render.com account created
- [ ] GitHub repository with Django code
- [ ] Cloudinary account configured
- [ ] Environment variables prepared
- [ ] Database backup from Node.js system (if migrating)

## Deployment Steps

### 1. Prepare Repository

1. Ensure all code is committed and pushed to GitHub:
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

2. Verify `render.yaml` is in the repository root
3. Verify `requirements.txt` is up to date
4. Verify `.env.production.example` is present

### 2. Create Render Services

#### Option A: Using render.yaml (Recommended)

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository containing `render.yaml`
5. Render will automatically create all services defined in the blueprint

#### Option B: Manual Service Creation

##### Create PostgreSQL Database

1. Click "New" → "PostgreSQL"
2. Configure:
   - Name: `rotc-postgres`
   - Database: `rotc_db`
   - User: `rotc_user`
   - Region: Oregon (or closest to your users)
   - Plan: Starter (or higher for production)
3. Click "Create Database"
4. Save the Internal Database URL

##### Create Redis Instance

1. Click "New" → "Redis"
2. Configure:
   - Name: `rotc-redis`
   - Region: Oregon
   - Plan: Starter
   - Maxmemory Policy: allkeys-lru
3. Click "Create Redis"
4. Save the Internal Redis URL

##### Create Web Service (Django WSGI)

1. Click "New" → "Web Service"
2. Connect GitHub repository
3. Configure:
   - Name: `rotc-django-web`
   - Environment: Python 3
   - Region: Oregon
   - Branch: main
   - Build Command:
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
     ```
   - Start Command:
     ```bash
     gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120
     ```
   - Plan: Starter (or higher)
4. Add environment variables (see section below)
5. Click "Create Web Service"

##### Create WebSocket Service (Django Channels)

1. Click "New" → "Web Service"
2. Connect GitHub repository
3. Configure:
   - Name: `rotc-django-channels`
   - Environment: Python 3
   - Build Command:
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt
     ```
   - Start Command:
     ```bash
     daphne -b 0.0.0.0 -p $PORT config.asgi:application
     ```
4. Add environment variables
5. Click "Create Web Service"

##### Create Celery Worker

1. Click "New" → "Background Worker"
2. Connect GitHub repository
3. Configure:
   - Name: `rotc-celery-worker`
   - Environment: Python 3
   - Build Command:
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt
     ```
   - Start Command:
     ```bash
     celery -A config worker --loglevel=info --concurrency=2
     ```
4. Add environment variables
5. Click "Create Background Worker"

##### Create Celery Beat

1. Click "New" → "Background Worker"
2. Connect GitHub repository
3. Configure:
   - Name: `rotc-celery-beat`
   - Start Command:
     ```bash
     celery -A config beat --loglevel=info
     ```
4. Add environment variables
5. Click "Create Background Worker"

### 3. Configure Environment Variables

Add the following environment variables to each service:

#### Common Variables (All Services)

```
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False
SECRET_KEY=<generate-secure-key>
PYTHON_VERSION=3.11.0
```

#### Web Services (Django Web + Channels)

```
ALLOWED_HOSTS=rotc-django-web.onrender.com,your-custom-domain.com
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
DATABASE_URL=<from-postgres-service>
REDIS_URL=<from-redis-service>
CLOUDINARY_CLOUD_NAME=<your-cloudinary-name>
CLOUDINARY_API_KEY=<your-cloudinary-key>
CLOUDINARY_API_SECRET=<your-cloudinary-secret>
```

#### Worker Services (Celery)

```
DATABASE_URL=<from-postgres-service>
REDIS_URL=<from-redis-service>
CELERY_BROKER_URL=<from-redis-service>
CELERY_RESULT_BACKEND=<from-redis-service>
CLOUDINARY_CLOUD_NAME=<your-cloudinary-name>
CLOUDINARY_API_KEY=<your-cloudinary-key>
CLOUDINARY_API_SECRET=<your-cloudinary-secret>
```

### 4. Deploy Services

1. Render will automatically deploy after service creation
2. Monitor deployment logs in Render Dashboard
3. Wait for all services to show "Live" status

### 5. Verify Deployment

#### Check Web Service

```bash
curl https://rotc-django-web.onrender.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "celery": "running"
}
```

#### Check WebSocket Service

Use a WebSocket client to connect:
```
wss://rotc-django-channels.onrender.com/ws/updates/
```

#### Check Celery Worker

View logs in Render Dashboard:
```
[INFO] celery@worker ready
```

### 6. Run Initial Setup

#### Create Superuser

```bash
# Using Render Shell
render shell rotc-django-web
python manage.py createsuperuser
```

#### Load Initial Data (if needed)

```bash
python manage.py loaddata initial_data.json
```

### 7. Configure Custom Domain (Optional)

1. Go to service settings in Render Dashboard
2. Click "Custom Domains"
3. Add your domain (e.g., api.your-domain.com)
4. Update DNS records as instructed by Render
5. Wait for SSL certificate provisioning

### 8. Set Up Monitoring

#### Enable Render Monitoring

1. Go to service settings
2. Enable "Health Check Path": `/api/health`
3. Set check interval: 30 seconds

#### Configure Sentry (Optional)

1. Create Sentry project
2. Add SENTRY_DSN environment variable
3. Redeploy services

### 9. Data Migration (If Migrating from Node.js)

1. Export data from Node.js database:
```bash
cd rotc_backend/scripts
python export_nodejs_data.py --output ./exports
```

2. Import data to Django database:
```bash
python import_django_data.py --data-dir ./exports
```

3. Verify migration:
```bash
python verify_migration.py --data-dir ./exports
```

## Staging Environment

### Create Staging Services

1. Duplicate all services with `-staging` suffix
2. Use separate database and Redis instances
3. Configure staging environment variables:
```
DJANGO_SETTINGS_MODULE=config.settings.staging
ENVIRONMENT=staging
```

### Staging Workflow

1. Deploy to staging first
2. Run integration tests
3. Verify all features work
4. If successful, deploy to production

## Production Deployment Checklist

- [ ] All services created and configured
- [ ] Environment variables set correctly
- [ ] Database migrations applied
- [ ] Static files collected
- [ ] Superuser created
- [ ] Health checks passing
- [ ] SSL certificates active
- [ ] Custom domain configured
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Rollback plan documented
- [ ] Team notified of deployment

## Rollback Procedure

### Quick Rollback

1. Go to Render Dashboard
2. Select the service
3. Click "Manual Deploy"
4. Select previous successful deployment
5. Click "Deploy"

### Full Rollback

1. Revert code changes in GitHub
2. Trigger redeployment
3. Restore database from backup if needed:
```bash
pg_restore -d $DATABASE_URL backup.sql
```

## Troubleshooting

### Service Won't Start

1. Check logs in Render Dashboard
2. Verify environment variables
3. Check build command output
4. Verify requirements.txt is correct

### Database Connection Errors

1. Verify DATABASE_URL is correct
2. Check database service is running
3. Verify IP allowlist settings
4. Test connection manually:
```bash
psql $DATABASE_URL
```

### Redis Connection Errors

1. Verify REDIS_URL is correct
2. Check Redis service is running
3. Test connection:
```bash
redis-cli -u $REDIS_URL ping
```

### Static Files Not Loading

1. Verify collectstatic ran successfully
2. Check STATIC_ROOT and STATIC_URL
3. Verify WhiteNoise is configured
4. Check file permissions

### Celery Tasks Not Running

1. Check Celery worker logs
2. Verify CELERY_BROKER_URL is correct
3. Check Redis connection
4. Verify task is registered

### WebSocket Connection Fails

1. Check Channels service is running
2. Verify WebSocket URL is correct
3. Check CORS settings
4. Verify Redis channel layer configuration

## Monitoring and Maintenance

### Daily Checks

- [ ] Check service health status
- [ ] Review error logs
- [ ] Monitor response times
- [ ] Check Celery queue length

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Check disk usage
- [ ] Review security logs
- [ ] Update dependencies if needed

### Monthly Tasks

- [ ] Database backup verification
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Cost analysis

## Support

For issues or questions:
- Check Render documentation: https://render.com/docs
- Review Django deployment guide: https://docs.djangoproject.com/en/5.0/howto/deployment/
- Contact team lead or DevOps

## Additional Resources

- [Render.com Documentation](https://render.com/docs)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [Celery Documentation](https://docs.celeryproject.org/)
- [Django Channels Documentation](https://channels.readthedocs.io/)
