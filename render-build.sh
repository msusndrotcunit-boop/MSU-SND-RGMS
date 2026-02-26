#!/usr/bin/env bash
# Render build script for Django + React monorepo

set -o errexit  # Exit on error

echo "=== Starting Build Process ==="

# Check Node.js availability
echo "Checking for Node.js..."
if command -v node &> /dev/null; then
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
else
    echo "WARNING: Node.js not found in PATH"
    echo "Attempting to use Render's Node.js..."
    # Render typically has Node.js available, just not in PATH
    export PATH="/opt/render/.nvm/versions/node/v18.17.0/bin:$PATH"
    if command -v node &> /dev/null; then
        echo "Node.js found: $(node --version)"
    else
        echo "ERROR: Node.js is required but not available"
        exit 1
    fi
fi

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
