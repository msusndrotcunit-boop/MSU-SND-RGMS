FROM node:18-alpine AS frontend

WORKDIR /app

COPY client/package*.json client/

WORKDIR /app/client
RUN npm ci

COPY client/ .
RUN npm run build

FROM python:3.11-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY server_django/requirements.txt server_django/requirements.txt
RUN pip install --no-cache-dir -r server_django/requirements.txt

COPY server_django/ server_django/
COPY --from=frontend /app/client/dist ./client/dist

ENV PORT=8000

CMD ["sh", "-c", "cd server_django && python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn rotc_backend.wsgi:application --bind 0.0.0.0:$PORT"]

