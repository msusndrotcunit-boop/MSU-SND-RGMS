# Render Deployment with NeonDB and Cloudinary

## Architecture Overview

This Django application uses external services for data storage:

- **NeonDB (PostgreSQL)**: Stores all text data, user information, grades, attendance records, etc.
- **Cloudinary**: Stores all media files (images, PDFs, documents)
- **External Redis**: Required for Celery (background tasks) and Django Channels (WebSocket)

## Prerequisites

1. **NeonDB Account**: Sign up at https://neon.tech
2. **Cloudinary Account**: Sign up at https://cloudinary.com
3. **Redis Provider**: Choose one:
   - Upstash Redis (https://upstash.com) - Free tier available
   - Redis Labs (https://redis.com) - Free tier available
   - Render Redis (paid)

## Step 1: Set Up NeonDB

1. Create a new project in NeonDB
2. Create a database named `rotc_db`
3. Copy the connection string (it looks like):
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/rotc_db?sslmode=require
   ```
4. Save this as your `DATABASE_URL`

## Step 2: Set Up Cloudinary

1. Go to your Cloudinary dashboard
2. Copy the following credentials:
   - Cloud Name
   - API Key
   - API Secret
3. Save these for environment variables

## Step 3: Set Up Redis

### Option A: Upstash Redis (Recommended - Free Tier)
1. Create a database at https://console.upstash.com
2. Copy the Redis URL (format: `rediss://default:password@host:port`)
3. Use this for both `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND`

### Option B: Redis Labs
1. Create a database at https://redis.com
2. Copy the connection string
3. Use for Redis environment variables

## Step 4: Configure Render Service

### Method 1: Using Render Dashboard (Recommended)

1. Go to Render Dashboard
2. Click on your service (MSU-SND-RGMS-1)
3. Go to **Settings**
4. Update **Root Directory** to: `rotc_backend`
5. Add/Update Environment Variables:

```bash
# Django Settings
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False
SECRET_KEY=<generate-random-secret-key>
PYTHON_VERSION=3.11.0

# Allowed Hosts (your Render domain)
ALLOWED_HOSTS=your-app.onrender.com,your-custom-domain.com

# CORS Origins (your frontend URLs)
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-custom-domain.com

# NeonDB PostgreSQL
DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/rotc_db?sslmode=require

# External Redis (Upstash/Redis Labs)
REDIS_URL=rediss://default:password@host:port
CELERY_BROKER_URL=rediss://default:password@host:port
CELERY_RESULT_BACKEND=rediss://default:password@host:port

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

6. **Build Command**:
```bash
pip install --upgrade pip && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
```

7. **Start Command**:
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120
```

8. Click **Save Changes**
9. Click **Manual Deploy** → **Deploy latest commit**

### Method 2: Using render.yaml (Alternative)

If you want to use the render.yaml file:

1. Delete the current service from Render
2. Create a new service using **"New" → "Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. You'll still need to manually add environment variables in the dashboard

## Step 5: Verify Deployment

After deployment completes:

1. Check the deployment logs for errors
2. Visit your app URL: `https://your-app.onrender.com/api/health`
3. You should see a health check response
4. Test the admin panel: `https://your-app.onrender.com/admin/`

## Step 6: Run Initial Data Migration (Optional)

If you have existing data from Node.js backend:

```bash
# SSH into Render shell (from dashboard)
python scripts/export_nodejs_data.py
python scripts/import_django_data.py
python scripts/verify_migration.py
```

## Troubleshooting

### Database Connection Issues

**Error**: `could not connect to server`
- Verify NeonDB connection string is correct
- Ensure `?sslmode=require` is at the end of DATABASE_URL
- Check NeonDB IP allowlist (should allow all IPs for Render)

### Redis Connection Issues

**Error**: `Error connecting to Redis`
- Verify Redis URL format is correct
- For Upstash, use `rediss://` (with double 's' for SSL)
- Ensure Redis provider allows connections from Render IPs

### Cloudinary Upload Issues

**Error**: `Cloudinary credentials not found`
- Verify all three Cloudinary environment variables are set
- Check for typos in variable names
- Ensure no extra spaces in values

### Migration Errors

**Error**: `relation "users" does not exist`
- Run migrations manually: `python manage.py migrate`
- Check if DATABASE_URL is pointing to correct database
- Verify NeonDB database exists

### Static Files Not Loading

**Error**: `404 on static files`
- Ensure `collectstatic` runs in build command
- Check `STATIC_ROOT` and `STATIC_URL` in settings
- Verify Whitenoise is installed and configured

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | NeonDB PostgreSQL connection | `postgresql://user:pass@host/db` |
| `REDIS_URL` | Redis for caching and channels | `rediss://default:pass@host:port` |
| `CELERY_BROKER_URL` | Celery message broker | Same as REDIS_URL |
| `CELERY_RESULT_BACKEND` | Celery results storage | Same as REDIS_URL |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abcdefghijklmnopqrstuvwxyz` |
| `SECRET_KEY` | Django secret key | Random 50-char string |
| `DEBUG` | Debug mode (always False) | `False` |
| `ALLOWED_HOSTS` | Allowed domains | `app.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | Frontend URLs | `https://frontend.vercel.app` |

## Data Flow

```
User Request
    ↓
Render (Django)
    ↓
├─→ NeonDB (PostgreSQL) ──→ Text data (users, grades, attendance)
├─→ Cloudinary ──→ Media files (images, PDFs, documents)
└─→ Redis ──→ Cache, Celery tasks, WebSocket channels
```

## Cost Estimate

- **Render Web Service**: $7/month (Starter plan)
- **NeonDB**: Free tier (0.5GB storage, 100 hours compute/month)
- **Cloudinary**: Free tier (25GB storage, 25GB bandwidth/month)
- **Upstash Redis**: Free tier (10,000 commands/day)

**Total**: ~$7/month (if staying within free tiers for external services)

## Next Steps

1. ✅ Fix Root Directory in Render dashboard
2. ✅ Add all environment variables
3. ✅ Deploy the application
4. ⏳ Test all endpoints
5. ⏳ Run data migration (if needed)
6. ⏳ Configure custom domain (optional)
7. ⏳ Set up monitoring and alerts

## Support

For issues:
- Check Render logs: Dashboard → Logs
- Check NeonDB status: https://neon.tech/status
- Check Cloudinary status: https://status.cloudinary.com
- Review Django logs in Render shell
