# Quick Monorepo Setup Checklist

## For Your Existing `MSU-SND-RGMS-1` Service

### ✅ Step 1: Update Start Command

In Render Dashboard → MSU-SND-RGMS-1 → Settings → Start Command:

**Change from**:
```bash
cd rotc_backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application
```

**To** (add logging):
```bash
cd rotc_backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application --verbosity 1 --access-log -
```

**Or if currently using Gunicorn, change to**:
```bash
cd rotc_backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application --verbosity 1 --access-log -
```

### ✅ Step 2: Verify Environment Variables

Ensure these are set in your service:

**Required**:
- ✅ `DJANGO_ENV=production`
- ✅ `DJANGO_SETTINGS_MODULE=config.settings.production`
- ✅ `DATABASE_URL` (your PostgreSQL connection string)
- ✅ `REDIS_URL` (your Redis connection string)
- ✅ `ALLOWED_HOSTS=msu-snd-rgms-1.onrender.com,localhost,127.0.0.1`
- ✅ `CORS_ALLOWED_ORIGINS=https://msu-snd-rgms-1.onrender.com`

**Optional but Recommended**:
- `CLOUDINARY_CLOUD_NAME` (for file uploads)
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SENTRY_DSN` (for error tracking)
- `DAPHNE_VERBOSITY=1`

### ✅ Step 3: Add Celery Worker Service

1. Go to Render Dashboard
2. Click "New" → "Background Worker"
3. Connect your GitHub repository
4. Configure:

**Name**: `msu-snd-rgms-celery-worker`

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && celery -A config worker --loglevel=info --concurrency=2
```

**Environment Variables**: Copy all from MSU-SND-RGMS-1

### ✅ Step 4: Add Celery Beat Service

1. Go to Render Dashboard
2. Click "New" → "Background Worker"
3. Connect your GitHub repository
4. Configure:

**Name**: `msu-snd-rgms-celery-beat`

**Build Command**:
```bash
cd rotc_backend && pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command**:
```bash
cd rotc_backend && celery -A config beat --loglevel=info
```

**Environment Variables**: Copy DATABASE_URL and REDIS_URL from MSU-SND-RGMS-1

### ✅ Step 5: Deploy Changes

1. Click "Manual Deploy" → "Deploy latest commit" on MSU-SND-RGMS-1
2. Wait for deployment to complete
3. Check logs for any errors

### ✅ Step 6: Verify Everything Works

**Test Health Endpoint**:
```bash
curl https://msu-snd-rgms-1.onrender.com/api/health/
```

**Test API**:
```bash
curl https://msu-snd-rgms-1.onrender.com/api/v1/auth/login
```

**Test WebSocket** (in browser console):
```javascript
const ws = new WebSocket('wss://msu-snd-rgms-1.onrender.com/ws/notifications/');
ws.onopen = () => console.log('Connected!');
```

**Check Worker Logs**:
- Go to msu-snd-rgms-celery-worker → Logs
- Look for "celery@worker ready"

**Check Beat Logs**:
- Go to msu-snd-rgms-celery-beat → Logs
- Look for "Scheduler: Sending due task"

---

## Frontend Configuration

Your frontend is already configured correctly in `client/.env.production`:

```bash
VITE_API_URL=https://msu-snd-rgms-1.onrender.com
VITE_WS_URL=wss://msu-snd-rgms-1.onrender.com
```

**Both use the same URL!** ✅

---

## Architecture Summary

```
https://msu-snd-rgms-1.onrender.com
├── /api/v1/*          → REST API (Daphne handles HTTP)
├── /ws/*              → WebSocket (Daphne handles WebSocket)
├── /static/*          → Static files (WhiteNoise)
└── /admin/            → Django admin

Background (invisible to users):
├── msu-snd-rgms-celery-worker  → Processes background tasks
└── msu-snd-rgms-celery-beat    → Schedules periodic tasks
```

---

## That's It!

Your system will now:
- ✅ Handle API requests at `https://msu-snd-rgms-1.onrender.com/api/v1/*`
- ✅ Handle WebSocket at `wss://msu-snd-rgms-1.onrender.com/ws/*`
- ✅ Process background tasks (emails, reports, file processing)
- ✅ Run scheduled tasks (cleanup, backups, sync)
- ✅ All under one URL!

**Total Services**: 3 (1 web + 2 workers)  
**Total Cost**: $0 (free tier) or $21/month (starter tier)

---

## Need Help?

Refer to:
- `MONOREPO_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `RENDER_DEPLOYMENT_COMPLETE_GUIDE.md` - Detailed troubleshooting
- Render Dashboard Logs - Real-time error messages
