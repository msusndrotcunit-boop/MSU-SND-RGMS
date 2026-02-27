#!/usr/bin/env bash
# exit on error
set -o errexit

echo "========================================="
echo "Starting Frontend Build Process"
echo "========================================="

# Install dependencies
echo "Installing Node dependencies..."
npm ci

# Build the frontend
echo "Building frontend..."
npm run build

# Copy build to backend static directory
echo "Copying build to backend..."
rm -rf ../rotc_backend/frontend_build
cp -r dist ../rotc_backend/frontend_build

echo "========================================="
echo "Frontend Build Complete!"
echo "========================================="
