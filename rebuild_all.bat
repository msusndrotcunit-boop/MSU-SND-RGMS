@echo off
REM Complete rebuild script for MSU-SND RGMS (Windows)
REM This script rebuilds both frontend and backend

echo =========================================
echo MSU-SND RGMS - Complete Rebuild
echo =========================================

REM Step 1: Clean previous builds
echo.
echo Step 1: Cleaning previous builds...
if exist client\dist rmdir /s /q client\dist
if exist client\node_modules\.vite rmdir /s /q client\node_modules\.vite
if exist rotc_backend\frontend_build rmdir /s /q rotc_backend\frontend_build
if exist rotc_backend\staticfiles rmdir /s /q rotc_backend\staticfiles
echo [OK] Cleaned previous builds

REM Step 2: Install frontend dependencies
echo.
echo Step 2: Installing frontend dependencies...
cd client
call npm ci
if errorlevel 1 (
    echo [ERROR] Frontend dependencies installation failed
    exit /b 1
)
echo [OK] Frontend dependencies installed

REM Step 3: Build frontend
echo.
echo Step 3: Building frontend...
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed
    exit /b 1
)
echo [OK] Frontend built successfully

REM Step 4: Copy frontend build to backend
echo.
echo Step 4: Copying frontend to backend...
cd ..
xcopy /E /I /Y client\dist rotc_backend\frontend_build
echo [OK] Frontend copied to backend

REM Step 5: Install backend dependencies
echo.
echo Step 5: Installing backend dependencies...
cd rotc_backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Backend dependencies installation failed
    exit /b 1
)
echo [OK] Backend dependencies installed

REM Step 6: Collect static files
echo.
echo Step 6: Collecting static files...
python manage.py collectstatic --no-input --settings=config.settings.production
if errorlevel 1 (
    echo [ERROR] Static files collection failed
    exit /b 1
)
echo [OK] Static files collected

REM Step 7: Run migrations
echo.
echo Step 7: Running database migrations...
python manage.py migrate --no-input --settings=config.settings.production
if errorlevel 1 (
    echo [ERROR] Migrations failed
    exit /b 1
)
echo [OK] Migrations completed

cd ..

echo.
echo =========================================
echo [OK] Rebuild Complete!
echo =========================================
echo.
echo Next steps:
echo   1. Commit changes: git add -A ^&^& git commit -m "Rebuild frontend and backend"
echo   2. Push to GitHub: git push origin main
echo   3. Render will automatically deploy
echo.
echo To test locally:
echo   Backend: cd rotc_backend ^&^& python manage.py runserver --settings=config.settings.development
echo   Frontend: cd client ^&^& npm run dev
echo.

pause
