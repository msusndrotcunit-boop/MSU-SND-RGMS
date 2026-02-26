# Deployment Commands for ROTC Django Backend

## Build Commands

### Render.com Build Command

The following command is configured in `render.yaml` and runs during deployment:

```bash
pip install --upgrade pip && \
pip install -r requirements.txt && \
python manage.py collectstatic --noinput && \
python manage.py migrate --noinput
```

### Manual Build Steps

If deploying manually, run these commands in order:

```bash
# 1. Update pip
pip install --upgrade pip

# 2. Install dependencies
pip install -r requirements.txt

# 3. Collect static files
python manage.py collectstatic --noinput

# 4. Run database migrations
python manage.py migrate --noinput

# 5. Create superuser (optional, first deployment only)
python manage.py createsuperuser --noinput \
  --username admin \
  --email admin@example.com

# 6. Load initial data (optional)
python manage.py loaddata initial_data.json
```

## Start Commands

### Web Service (WSGI - Gunicorn)

```bash
gunicorn config.wsgi:application \
  --bind 0.0.0.0:$PORT \
  --workers 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  --log-level info
```

With configuration file:

```bash
gunicorn config.wsgi:application -c gunicorn.conf.py
```

### WebSocket Service (ASGI - Daphne)

```bash
daphne -b 0.0.0.0 -p $PORT config.asgi:application
```

With verbosity:

```bash
daphne -b 0.0.0.0 -p $PORT -v 2 config.asgi:application
```

### Celery Worker

```bash
celery -A config worker \
  --loglevel=info \
  --concurrency=2 \
  --max-tasks-per-child=1000
```

### Celery Beat (Periodic Tasks)

```bash
celery -A config beat \
  --loglevel=info \
  --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### Combined Celery Worker + Beat (Development Only)

```bash
celery -A config worker -B \
  --loglevel=info \
  --concurrency=2
```

## Development Commands

### Run Development Server

```bash
# Django development server
python manage.py runserver 0.0.0.0:8000

# With specific settings
DJANGO_SETTINGS_MODULE=config.settings.development python manage.py runserver
```

### Run with Gunicorn (Development)

```bash
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --reload \
  --access-logfile - \
  --error-logfile -
```

### Run Daphne (Development)

```bash
daphne -b 0.0.0.0 -p 8001 config.asgi:application
```

## Database Commands

### Create Migrations

```bash
python manage.py makemigrations
```

### Apply Migrations

```bash
python manage.py migrate
```

### Show Migrations

```bash
python manage.py showmigrations
```

### Rollback Migration

```bash
python manage.py migrate app_name migration_name
```

### Reset Database (Development Only)

```bash
python manage.py flush --noinput
```

## Data Management Commands

### Export Data

```bash
python manage.py dumpdata > data.json
```

### Import Data

```bash
python manage.py loaddata data.json
```

### Create Superuser

```bash
python manage.py createsuperuser
```

### Shell Access

```bash
python manage.py shell
```

### Database Shell

```bash
python manage.py dbshell
```

## Testing Commands

### Run All Tests

```bash
pytest
```

### Run Specific Test File

```bash
pytest tests/test_authentication.py
```

### Run with Coverage

```bash
pytest --cov=apps --cov-report=html
```

### Run Property-Based Tests

```bash
pytest tests/property_tests/
```

## Maintenance Commands

### Clear Cache

```bash
python manage.py shell -c "from django.core.cache import cache; cache.clear()"
```

### Check Deployment Readiness

```bash
python manage.py check --deploy
```

### Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### Clean Up Old Sessions

```bash
python manage.py clearsessions
```

## Monitoring Commands

### Check Celery Status

```bash
celery -A config inspect active
celery -A config inspect stats
```

### Monitor Celery Tasks

```bash
celery -A config events
```

### Check Redis Connection

```bash
redis-cli -u $REDIS_URL ping
```

### Check Database Connection

```bash
python manage.py dbshell -c "SELECT 1;"
```

## Docker Commands (If Using Docker)

### Build Image

```bash
docker build -t rotc-backend .
```

### Run Container

```bash
docker run -p 8000:8000 \
  --env-file .env \
  rotc-backend
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Render.com Specific Commands

### View Logs

```bash
render logs --service rotc-django-web --tail
```

### SSH into Service

```bash
render ssh rotc-django-web
```

### Run One-off Command

```bash
render run --service rotc-django-web "python manage.py migrate"
```

## Environment-Specific Commands

### Production

```bash
# Set environment
export DJANGO_SETTINGS_MODULE=config.settings.production

# Run with production settings
python manage.py runserver --settings=config.settings.production
```

### Staging

```bash
# Set environment
export DJANGO_SETTINGS_MODULE=config.settings.staging

# Run with staging settings
python manage.py runserver --settings=config.settings.staging
```

### Development

```bash
# Set environment
export DJANGO_SETTINGS_MODULE=config.settings.development

# Run with development settings
python manage.py runserver --settings=config.settings.development
```

## Troubleshooting Commands

### Check System Status

```bash
python manage.py check
```

### Validate Models

```bash
python manage.py validate
```

### Show URLs

```bash
python manage.py show_urls
```

### Check Migrations

```bash
python manage.py showmigrations --list
```

### SQL for Migration

```bash
python manage.py sqlmigrate app_name migration_number
```

## Performance Commands

### Profile Request

```bash
python manage.py runprofileserver
```

### Show Slow Queries

```bash
python manage.py show_slow_queries
```

## Security Commands

### Check Security

```bash
python manage.py check --deploy
```

### Generate Secret Key

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Backup Commands

### Backup Database

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
psql $DATABASE_URL < backup_20240101_120000.sql
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `python manage.py runserver` | Start development server |
| `python manage.py migrate` | Apply database migrations |
| `python manage.py makemigrations` | Create new migrations |
| `python manage.py collectstatic` | Collect static files |
| `python manage.py createsuperuser` | Create admin user |
| `python manage.py shell` | Open Django shell |
| `python manage.py test` | Run tests |
| `gunicorn config.wsgi:application` | Start production server |
| `celery -A config worker` | Start Celery worker |
| `celery -A config beat` | Start Celery beat |

## Notes

- Always use `--noinput` flag for automated deployments
- Set `DJANGO_SETTINGS_MODULE` environment variable for correct settings
- Use `--settings` flag to override settings module
- Check logs for errors: `tail -f logs/django.log`
- Monitor resource usage: `htop` or `top`
- Use `screen` or `tmux` for persistent sessions
