# Monorepo Deployment Guide - Single URL
## MSU-SND ROTC Grading Management System

This guide configures the system to run under a single URL: `https://msu-snd-rgms-1.onrender.com`

---

## Architecture Overview

### Single URL Architecture

```
┌─────────────────────────────────────────────────────────┐
│              https://msu-snd-rgms-1.onrender.com         │
│                    (Single Entry Point)                  │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────┐                  ┌─────▼────┐
    │   HTTP   │                  │WebSocket │
    │   API    │                  │   /ws/*  │
    │/api/v1/* │                  │          │
    └────┬─────┘                  └─────┬────┘
         │                               │
         └───────────────┬───────────────┘
                         │
              ┌──────────▼──────────┐
              │  Daphne ASGI Server │
              │  (Handles Both)     │
              └──────────┬──────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────┐                  ┌─────▼────┐
    │PostgreSQL│                  │  Redis   │
    │ Database │                  │  Cache   │
    └──────────┘                  └─────┬────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │                             │
                  ┌──────▼──────┐            ┌────────▼────────┐
                  │Celery Worker│            │  Celery Beat    │
                  │(Background) │            │  (Scheduler)    │
                  └─────────────┘            └─────────────────┘
```

**Key Points:**
- One web service handles both HTTP API and WebSocket connections
- Uses Daphne ASGI server (can handle both HTTP and WebSocket)
- Background workers run separately but invisible to users
- All traffic goes through `https://msu-snd-rgms-1.onrender.com`

---

## Configuration for Existing Service

### Update Your Existing `MSU-SND-RGMS-1` Service

#### 1. Start Command

Change to use Daphne (which handles both HTTP and WebSocket):

```bash
cd rotc_backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application --verbosity 1 --access-log -
```

**Why Daphne?**
- Handles HTTP requests (like Gunicorn)
- Handles WebSocket connections (unlike Gunicorn)
- Single server for everything

#### 2. Environment Variables

Ensure these are set in your Render service:

```bash
# Core Django
PYTHON_VERSION=3.11.0
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_ENV=production
DJANGO_SECRET_KEY=<your-secret-key>
DEBUG=False

# Hosts and CORS
ALLOWED_HOSTS=msu-snd-rgms-1.onrender.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://msu-snd-rgms-1.onrender.com

# Database and Redis
DATABASE_URL=<your-postgresql-url>
REDIS_URL=<your-redis-url>

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Daphne Configuration
DAPHNE_VERBOSITY=1

# Optional: Sentry
SENTRY_DSN=<your-sentry-dsn>
```

#### 3. Build Command

Keep your existing build command:

```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt && python manage.py collectstatic --no-input --settings=config.settings.production && python manage.py migrate --no-input --settings=config.settings.production
```

---

## Add Background Worker Services

Even with a monorepo URL, you still need separate worker services for background tasks. These are invisible to users.

### Add Celery Worker Service

**Service Name**: `msu-snd-rgms-celery-worker`  
**Type**: Background Worker

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && celery -A config worker --loglevel=info --concurrency=2
```

**Environment Variables**: (Same as main service)

### Add Celery Beat Service

**Service Name**: `msu-snd-rgms-celery-beat`  
**Type**: Background Worker

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && celery -A config beat --loglevel=info
```

**Environment Variables**: (Same as main service)

---

## Frontend Configuration

### Update `.env.production`

Since everything is under one URL:

```bash
# Production Environment Configuration
VITE_API_URL=https://msu-snd-rgms-1.onrender.com
VITE_WS_URL=wss://msu-snd-rgms-1.onrender.com
VITE_ENV=production
```

**Both API and WebSocket use the same URL!**

---

## How It Works

### HTTP API Requests

```
Frontend → https://msu-snd-rgms-1.onrender.com/api/v1/auth/login
         → Daphne ASGI Server
         → Django REST Framework
         → Response
```

### WebSocket Connections

```
Frontend → wss://msu-snd-rgms-1.onrender.com/ws/notifications/
         → Daphne ASGI Server
         → Django Channels
         → Redis Channel Layer
         → Real-time Updates
```

### Background Tasks

```
API Request → Queue Task to Redis
            → Celery Worker picks up task
            → Processes in background
            → Updates database
            → Sends notification via WebSocket
```

### Scheduled Tasks

```
Celery Beat → Triggers scheduled task
            → Queues to Redis
            → Celery Worker processes
            → Completes task
```

---

## Verification Steps

### 1. Check Service Status

In Render dashboard, verify:
- ✅ MSU-SND-RGMS-1 is "Live"
- ✅ msu-snd-rgms-celery-worker is "Live"
- ✅ msu-snd-rgms-celery-beat is "Live"

### 2. Test Health Endpoint

```bash
curl https://msu-snd-rgms-1.onrender.com/api/health/
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-28T...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "celery": "running"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

### 3. Test API Endpoint

```bash
curl -X POST https://msu-snd-rgms-1.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

### 4. Test WebSocket Connection

```javascript
// In browser console or frontend
const ws = new WebSocket('wss://msu-snd-rgms-1.onrender.com/ws/notifications/?token=<jwt-token>');

ws.onopen = () => {
  console.log('✅ WebSocket connected to same URL as API!');
};

ws.onmessage = (event) => {
  console.log('📨 Message received:', JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error('❌ WebSocket error:', error);
};
```

### 5. Check Celery Worker Logs

In Render dashboard → msu-snd-rgms-celery-worker → Logs:

Look for:
```
[2024-02-28 10:30:00,000: INFO/MainProcess] celery@worker ready.
[2024-02-28 10:30:00,000: INFO/MainProcess] Connected to redis://...
```

### 6. Check Celery Beat Logs

In Render dashboard → msu-snd-rgms-celery-beat → Logs:

Look for:
```
[2024-02-28 10:30:00,000: INFO/MainProcess] beat: Starting...
[2024-02-28 10:30:00,000: INFO/MainProcess] Scheduler: Sending due task...
```

---

## Advantages of Monorepo URL

✅ **Simpler for users** - One URL to remember  
✅ **No CORS issues** - Same origin for API and WebSocket  
✅ **Easier SSL/TLS** - One certificate  
✅ **Simpler frontend config** - Same base URL  
✅ **Better for mobile apps** - Single endpoint  

---

## Disadvantages (and Mitigations)

❌ **Single point of failure** - If main service goes down, everything is down  
   ✅ Mitigation: Use Render's auto-restart and health checks

❌ **Can't scale HTTP and WebSocket independently**  
   ✅ Mitigation: Daphne handles both efficiently; upgrade to Starter plan if needed

❌ **Slightly higher resource usage** - One server handles everything  
   ✅ Mitigation: Daphne is efficient; monitor resource usage

---

## Performance Considerations

### Daphne vs Gunicorn

**Daphne (ASGI)**:
- ✅ Handles HTTP and WebSocket
- ✅ Async support
- ✅ Good for real-time features
- ⚠️ Slightly slower for pure HTTP than Gunicorn

**Gunicorn (WSGI)**:
- ✅ Faster for pure HTTP
- ❌ Cannot handle WebSocket
- ❌ Requires separate Channels service

**Recommendation**: Use Daphne for monorepo deployment. The performance difference is negligible for most use cases.

### Scaling Options

If you need better performance:

1. **Upgrade to Starter Plan** ($7/month)
   - More CPU and memory
   - No spin-down on inactivity
   - Better performance

2. **Add Redis Caching**
   - Cache frequently accessed data
   - Reduce database queries
   - Faster response times

3. **Optimize Database Queries**
   - Use select_related() and prefetch_related()
   - Add database indexes
   - Use database connection pooling

---

## Monitoring

### Key Metrics to Monitor

1. **Response Time**
   - Target: < 500ms for 95th percentile
   - Check in Render dashboard

2. **Error Rate**
   - Target: < 1%
   - Monitor in Sentry (if configured)

3. **WebSocket Connections**
   - Check active connections in logs
   - Monitor connection drops

4. **Celery Queue Length**
   - Target: < 100 pending tasks
   - Check in Redis or Celery logs

5. **Database Performance**
   - Monitor query times
   - Check connection pool usage

### Alerts to Set Up

- Service goes down
- Error rate > 5%
- Response time > 1 second
- Celery queue > 500 tasks
- Database connection errors

---

## Troubleshooting

### WebSocket Connection Fails

**Symptom**: WebSocket immediately disconnects

**Solutions**:
1. Verify Daphne is running (not Gunicorn)
2. Check JWT token is valid
3. Verify Redis is connected
4. Check CORS settings allow WebSocket
5. Test with WebSocket client tool

### API Requests Slow

**Symptom**: Response time > 1 second

**Solutions**:
1. Check database query performance
2. Enable Redis caching
3. Optimize database indexes
4. Upgrade to Starter plan
5. Check for N+1 query problems

### Celery Tasks Not Processing

**Symptom**: Tasks queue up but don't execute

**Solutions**:
1. Check Celery worker is running
2. Verify Redis connection
3. Check worker logs for errors
4. Restart worker service
5. Verify task queue name matches

### Service Keeps Restarting

**Symptom**: Service shows "Deploying" repeatedly

**Solutions**:
1. Check logs for errors
2. Verify all environment variables are set
3. Check port binding is `0.0.0.0:$PORT`
4. Verify database and Redis are accessible
5. Check health endpoint returns 200 OK

---

## Cost Estimate

### Free Tier (Current)

- MSU-SND-RGMS-1: Free
- msu-snd-rgms-celery-worker: Free
- msu-snd-rgms-celery-beat: Free
- PostgreSQL: Free (if using Render) or $0 (if using NeonDB free tier)
- Redis: Free (if using Render) or $0 (if using Upstash free tier)

**Total**: $0/month

**Limitations**:
- Services spin down after 15 minutes of inactivity
- 750 hours/month free (enough for 1 service running 24/7)
- Slower performance
- 512 MB RAM per service

### Starter Tier (Recommended for Production)

- MSU-SND-RGMS-1: $7/month
- msu-snd-rgms-celery-worker: $7/month
- msu-snd-rgms-celery-beat: $7/month
- PostgreSQL: $0 (NeonDB free tier)
- Redis: $0 (Upstash free tier)

**Total**: $21/month

**Benefits**:
- No spin-down
- Better performance
- 512 MB RAM per service
- Priority support

---

## Next Steps

1. **Update your existing service**:
   - Change start command to use Daphne
   - Verify environment variables
   - Deploy changes

2. **Add worker services**:
   - Create Celery Worker service
   - Create Celery Beat service
   - Verify they're running

3. **Update frontend**:
   - Set both API and WebSocket URLs to same domain
   - Rebuild and deploy frontend

4. **Test everything**:
   - Test API endpoints
   - Test WebSocket connections
   - Test background tasks
   - Test scheduled tasks

5. **Monitor for 24 hours**:
   - Check error rates
   - Monitor response times
   - Verify tasks are processing
   - Check for any issues

---

## Summary

With this monorepo configuration:

✅ **One URL**: `https://msu-snd-rgms-1.onrender.com`  
✅ **Handles HTTP API**: `/api/v1/*`  
✅ **Handles WebSocket**: `/ws/*`  
✅ **Background tasks**: Celery Worker (invisible to users)  
✅ **Scheduled tasks**: Celery Beat (invisible to users)  
✅ **Simple frontend config**: Same URL for everything  
✅ **No CORS issues**: Same origin  
✅ **Cost effective**: $0 (free tier) or $21/month (starter tier)  

**Status**: Ready to deploy! 🚀

---

**Last Updated**: 2024-02-28  
**Version**: 1.0.0
