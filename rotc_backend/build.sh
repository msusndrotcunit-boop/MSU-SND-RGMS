#!/usr/bin/env bash
# exit on error
set -o errexit

echo "========================================="
echo "Starting Build Process"
echo "========================================="

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --no-input --settings=config.settings.production

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --no-input --settings=config.settings.production

echo "========================================="
echo "Build Complete!"
echo "========================================="
