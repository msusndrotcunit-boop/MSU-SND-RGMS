#!/usr/bin/env bash
# Render build script for Django + React monorepo

set -o errexit  # Exit on error

echo "=== Starting Build Process ==="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 18..."
    # Download and install Node.js
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install Python dependencies
echo "=== Installing Python Dependencies ==="
cd rotc_backend
pip install --upgrade pip
pip install -r requirements.txt

# Build React frontend
echo "=== Building React Frontend ==="
cd ../client
npm install --legacy-peer-deps
npm run build

# Verify build output
if [ ! -f "dist/index.html" ]; then
    echo "ERROR: React build failed - index.html not found in dist/"
    ls -la dist/ || echo "dist/ directory does not exist"
    exit 1
fi

echo "React build successful! Files in dist/:"
ls -la dist/

# Copy built frontend to Django static files
echo "=== Copying Frontend to Django Static Files ==="
cd ../rotc_backend
mkdir -p staticfiles
cp -r ../client/dist/* staticfiles/

# Verify index.html was copied
if [ ! -f "staticfiles/index.html" ]; then
    echo "ERROR: index.html not copied to staticfiles/"
    ls -la staticfiles/ || echo "staticfiles/ directory is empty"
    exit 1
fi

echo "Frontend copied successfully! Files in staticfiles/:"
ls -la staticfiles/

# Collect Django static files
echo "=== Collecting Django Static Files ==="
python manage.py collectstatic --noinput

# Run database migrations
echo "=== Running Database Migrations ==="
python manage.py migrate --noinput

echo "=== Build Process Complete ==="
