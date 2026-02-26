# Quick Deploy Guide - Render.com

Get your Django backend deployed in under 10 minutes.

## What You Need (Minimum)

1. **NeonDB** (PostgreSQL) - Free tier
2. **Cloudinary** (Media storage) - Free tier
3. **Upstash Redis** (For WebSocket/Celery) - Free tier

## Step 1: Set Up External Services (5 minutes)

### NeonDB Setup
1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy your connection string (looks like):
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as `DATABASE_URL`

### Cloudinary Setup
1. Go to https://cloudinary.com and sign up
2. From dashboard, copy:
   - Cloud Name
   - API Key
   - API Secret

### Upstash Redis Setup
1. Go to https://console.upstash.com and sign up
2. Create a new Redis database
3. Copy the Redis URL (looks like):
   ```
   rediss://default:xxx@xxx.upstash.io:6379
   ```
4. Save this as `REDIS_URL`

## Step 2: Fix Render Configuration (2 minutes)

### In Render Dashboard:

1. Go to https://dashboard.render.com
2. Click on your service (MSU-SND-RGMS or similar)
3. Go to **Settings** tab
4. Update these fields:

**Root Directory:**
```
rotc_backend
```

**Build Command:**
```bash
pip install --upgrade pip && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
```

**Start Command:**
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120
```

## Step 3: Add Environment Variables (3 minutes)

In Render Dashboard → Settings → Environment Variables, add:

### Required Variables:

```bash
# Django
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False
SECRET_KEY=<generate-random-50-char-string>
PYTHON_VERSION=3.11.0

# Your Render domain (replace with your actual domain)
ALLOWED_HOSTS=your-app.onrender.com

# Your frontend URL (replace with your actual frontend)
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app

# NeonDB (from Step 1)
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Upstash Redis (from Step 1)
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
CELERY_BROKER_URL=rediss://default:xxx@xxx.upstash.io:6379
CELERY_RESULT_BACKEND=rediss://default:xxx@xxx.upstash.io:6379

# Cloudinary (from Step 1)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Generate SECRET_KEY:

Run this in Python:
```python
import secrets
print(secrets.token_urlsafe(50))
```

## Step 4: Deploy (1 minute)

1. Click **Save Changes**
2. Go to **Manual Deploy** tab
3. Click **Deploy latest commit**
4. Wait 3-5 minutes for deployment

## Step 5: Verify Deployment

Once deployed, test these URLs (replace with your domain):

1. **Health Check**: `https://your-app.onrender.com/api/health`
2. **Admin Panel**: `https://your-app.onrender.com/admin/`
3. **API Docs**: `https://your-app.onrender.com/api/`

## What About Celery Workers?

For quick deployment, you can skip Celery workers initially. The app will work but:
- Image uploads will be slower (processed synchronously)
- No background tasks
- No scheduled tasks

### Add Celery Later (Optional):

In Render Dashboard, create a new **Background Worker**:
- **Name**: rotc-celery-worker
- **Environment**: Python
- **Root Directory**: `rotc_backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `celery -A config worker -l info --concurrency=2`
- **Environment Variables**: Same as web service

## Troubleshooting

### Deployment Fails with "Root directory does not exist"
- Make sure Root Directory is set to `rotc_backend` (not `server_django`)

### Database Connection Error
- Verify DATABASE_URL has `?sslmode=require` at the end
- Check NeonDB is active (not paused)

### Static Files Not Loading
- Ensure `collectstatic` is in build command
- Check STATIC_ROOT in settings

### Redis Connection Error
- Verify REDIS_URL uses `rediss://` (with double 's')
- Check Upstash Redis is active

## Cost Breakdown

- **Render Web Service**: $7/month (Starter plan)
- **NeonDB**: Free (0.5GB storage, 100 hours compute/month)
- **Cloudinary**: Free (25GB storage, 25GB bandwidth/month)
- **Upstash Redis**: Free (10,000 commands/day)

**Total**: $7/month

## Next Steps After Deployment

1. Create superuser account (via Render Shell):
   ```bash
   python manage.py createsuperuser
   ```

2. Test API endpoints with your frontend

3. Add Celery workers if you need background tasks

4. Set up custom domain (optional)

5. Configure monitoring and alerts

## Need Help?

Check deployment logs in Render Dashboard → Logs tab for detailed error messages.
