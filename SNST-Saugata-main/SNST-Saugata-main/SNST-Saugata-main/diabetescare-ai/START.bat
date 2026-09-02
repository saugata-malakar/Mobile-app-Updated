@echo off
cls
echo ========================================================================
echo                   DIABETESCARE AI - WOUND ANALYSIS
echo ========================================================================
echo.
echo Starting the complete application...
echo.
echo Once started, open your browser to: http://localhost:8000
echo.
echo Press Ctrl+C to stop the application
echo ========================================================================
echo.

REM Kill any existing processes on port 8000
echo [1/2] Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)
echo Port 8000 is ready.
echo.

REM Start the server
echo [2/2] Starting server...
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload

pause
