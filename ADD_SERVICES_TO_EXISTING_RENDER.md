# Adding Services to Existing Render Deployment

You already have `MSU-SND-RGMS-1` deployed. Now we'll add the three additional services needed for the complete architecture.

## Current Setup

- ✅ **MSU-SND-RGMS-1** (Web Service) - Already deployed
  - URL: https://msu-snd-rgms-1.onrender.com
  - Currently running Daphne (ASGI)

## What We Need to Add

1. **Django Channels Service** - WebSocket support (separate from main API)
2. **Celery Worker Service** - Background task processing
3. **Celery Beat Service** - Scheduled task execution

---

## Step 1: Update Existing Service (MSU-SND-RGMS-1)

Your existing service should be the main REST API server using Gunicorn.

### Update Start Command:

Go to your service settings and change the start command to:

```bash
cd rotc_backend && gunicorn -c gunicorn.conf.py config.wsgi:application
```

### Verify Environment Variables:

Ensure these are set:
- `DJANGO_ENV=production`
- `DJANGO_SETTINGS_MODULE=config.settings.production`
- `DATABASE_URL` (from your PostgreSQL)
- `REDIS_URL` (from your Redis)
- `ALLOWED_HOSTS=msu-snd-rgms-1.onrender.com,localhost,127.0.0.1`
- `CORS_ALLOWED_ORIGINS=https://msu-snd-rgms-1.onrender.com`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

---

## Step 2: Add Django Channels Service

### Create New Web Service:

1. Go to Render Dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:

**Service Name**: `msu-snd-rgms-channels`

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application --verbosity 1 --access-log -
```

**Environment Variables**:
```
PYTHON_VERSION=3.11.0
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_ENV=production
DJANGO_SECRET_KEY=<same-as-main-service>
DEBUG=False
ALLOWED_HOSTS=msu-snd-rgms-channels.onrender.com,localhost,127.0.0.1
DATABASE_URL=<same-as-main-service>
REDIS_URL=<same-as-main-service>
DAPHNE_VERBOSITY=1
```

**Plan**: Free or Starter (depending on your needs)

---

## Step 3: Add Celery Worker Service

### Create New Worker Service:

1. Go to Render Dashboard
2. Click "New" → "Background Worker"
3. Connect your GitHub repository
4. Configure:

**Service Name**: `msu-snd-rgms-celery-worker`

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && celery -A config worker --loglevel=info --concurrency=2
```

**Environment Variables**:
```
PYTHON_VERSION=3.11.0
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_ENV=production
DJANGO_SECRET_KEY=<same-as-main-service>
DEBUG=False
DATABASE_URL=<same-as-main-service>
REDIS_URL=<same-as-main-service>
CLOUDINARY_CLOUD_NAME=<same-as-main-service>
CLOUDINARY_API_KEY=<same-as-main-service>
CLOUDINARY_API_SECRET=<same-as-main-service>
```

**Plan**: Free or Starter

---

## Step 4: Add Celery Beat Service

### Create New Worker Service:

1. Go to Render Dashboard
2. Click "New" → "Background Worker"
3. Connect your GitHub repository
4. Configure:

**Service Name**: `msu-snd-rgms-celery-beat`

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && celery -A config beat --loglevel=info
```

**Environment Variables**:
```
PYTHON_VERSION=3.11.0
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_ENV=production
DJANGO_SECRET_KEY=<same-as-main-service>
DEBUG=False
DATABASE_URL=<same-as-main-service>
REDIS_URL=<same-as-main-service>
```

**Plan**: Free or Starter

---

## Step 5: Update Frontend Configuration

Since you're keeping the existing service URL, you have two options:

### Option A: Keep Using Existing URL (Simpler)

Keep your frontend pointing to `https://msu-snd-rgms-1.onrender.com` for both API and WebSocket.

Update `client/.env.production`:
```bash
VITE_API_URL=https://msu-snd-rgms-1.onrender.com
VITE_WS_URL=wss://msu-snd-rgms-1.onrender.com
```

**Note**: This means your main service needs to handle both HTTP and WebSocket. You'll need to run Daphne (which can handle both) instead of Gunicorn.

### Option B: Use Separate Services (Recommended)

Use the main service for API and the new Channels service for WebSocket.

Update `client/.env.production`:
```bash
VITE_API_URL=https://msu-snd-rgms-1.onrender.com
VITE_WS_URL=wss://msu-snd-rgms-channels.onrender.com
```

**Recommended**: Use Option B for better separation of concerns and scalability.

---

## Step 6: Verify Deployment

### Check Service Status:

All services should show "Live" status in Render dashboard:
- ✅ MSU-SND-RGMS-1 (Web Service - Gunicorn or Daphne)
- ✅ msu-snd-rgms-channels (Web Service - Daphne)
- ✅ msu-snd-rgms-celery-worker (Worker)
- ✅ msu-snd-rgms-celery-beat (Worker)

### Test Health Check:

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
  }
}
```

### Test WebSocket Connection:

```javascript
const ws = new WebSocket('wss://msu-snd-rgms-channels.onrender.com/ws/notifications/?token=<jwt-token>');
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', event.data);
```

### Check Celery Logs:

In Render dashboard:
1. Go to `msu-snd-rgms-celery-worker`
2. Check logs for "celery@worker ready"
3. Go to `msu-snd-rgms-celery-beat`
4. Check logs for "Scheduler: Sending due task"

---

## Architecture After Adding Services

```
┌─────────────────────────────────────────────────────────┐
│                    Render Platform                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ MSU-SND-RGMS-1   │  │msu-snd-rgms-     │            │
│  │   (Gunicorn)     │  │  channels        │            │
│  │   REST API       │  │  (Daphne)        │            │
│  │   Free Tier      │  │  WebSockets      │            │
│  └────────┬─────────┘  └────────┬─────────┘            │
│           │                     │                        │
│           └──────────┬──────────┘                        │
│                      │                                   │
│           ┌──────────▼──────────┐                       │
│           │   PostgreSQL DB     │                       │
│           │   (Your existing)   │                       │
│           └──────────┬──────────┘                       │
│                      │                                   │
│           ┌──────────▼──────────┐                       │
│           │       Redis         │                       │
│           │   (Your existing)   │                       │
│           └──────────┬──────────┘                       │
│                      │                                   │
│           ┌──────────┴──────────┐                       │
│           │                     │                        │
│  ┌────────▼────────┐  ┌────────▼────────┐             │
│  │msu-snd-rgms-    │  │msu-snd-rgms-    │             │
│  │celery-worker    │  │celery-beat      │             │
│  │(Background)     │  │(Scheduler)      │             │
│  │Free Tier        │  │Free Tier        │             │
│  └─────────────────┘  └─────────────────┘             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Cost Estimate

If using Free tier for all services:
- MSU-SND-RGMS-1: Free
- msu-snd-rgms-channels: Free
- msu-snd-rgms-celery-worker: Free
- msu-snd-rgms-celery-beat: Free

**Total**: $0/month

**Note**: Free tier services spin down after 15 minutes of inactivity and may have slower performance.

If upgrading to Starter tier:
- Each service: $7/month
- Total for 4 services: $28/month

---

## Troubleshooting

### Service Won't Start

Check logs in Render dashboard for errors. Common issues:
- Missing environment variables
- Incorrect start command
- Port binding issues (ensure using `$PORT`)

### Celery Worker Not Processing Tasks

1. Check Redis connection in worker logs
2. Verify `REDIS_URL` is correct
3. Check task queue length in Redis
4. Restart worker service

### WebSocket Connection Fails

1. Verify Channels service is running
2. Check JWT token is valid
3. Verify Redis channel layer is configured
4. Test with WebSocket client tool

---

## Next Steps

1. Add the three new services following the steps above
2. Update frontend configuration (if using separate Channels service)
3. Test all endpoints and WebSocket connections
4. Monitor logs for any errors
5. Consider upgrading to Starter tier for better performance

---

## Support

If you encounter issues:
1. Check service logs in Render dashboard
2. Verify all environment variables are set correctly
3. Test each service individually
4. Refer to `RENDER_DEPLOYMENT_COMPLETE_GUIDE.md` for detailed troubleshooting

**Last Updated**: 2024-02-28
