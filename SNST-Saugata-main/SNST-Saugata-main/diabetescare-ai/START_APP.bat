@echo off
title DiabetesCare AI - Complete Application
color 0A

echo.
echo ========================================================================
echo              DIABETESCARE AI - COMPLETE APPLICATION
echo ========================================================================
echo.
echo This will start the COMPLETE merged application on ONE PORT
echo.
echo Application URL: http://localhost:8000
echo   - Frontend (Web Interface) at http://localhost:8000
echo   - Backend API at http://localhost:8000/api/v1/wound/predict
echo   - API Docs at http://localhost:8000/docs
echo.
echo ========================================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

echo [1/5] Checking Python installation...
python --version
echo.

echo [2/5] Checking if port 8000 is in use...
netstat -ano | findstr :8000 >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port 8000 is already in use!
    echo Attempting to free port 8000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
        echo Killing process ID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo Port 8000 freed.
)
echo Port 8000 is available.
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo [WARNING] Virtual environment not found!
    echo Creating virtual environment...
    python -m venv venv
    echo Virtual environment created.
    echo.
)

echo [3/5] Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Check if requirements are installed
echo [4/5] Checking dependencies...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Dependencies not installed!
    echo Installing requirements...
    pip install -r requirements.txt
    echo.
)

echo [5/5] Starting application...
echo.
echo ========================================================================
echo                    APPLICATION STARTING
echo ========================================================================
echo.
echo The complete application is starting on port 8000...
echo.
echo Once started, your browser will open automatically to:
echo   http://localhost:8000
echo.
echo You will see:
echo   - Modern web interface
echo   - Upload wound images
echo   - Get instant AI analysis
echo   - Download reports
echo.
echo Press Ctrl+C to stop the application
echo.
echo ========================================================================
echo.

REM Wait 3 seconds then open browser
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

REM Start the merged application
echo Starting server...
echo.
python -m uvicorn backend.api.main:app --reload --port 8000 --host 0.0.0.0

pause
