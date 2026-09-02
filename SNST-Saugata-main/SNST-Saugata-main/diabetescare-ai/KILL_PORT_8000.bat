@echo off
echo ========================================
echo Killing processes on port 8000...
echo ========================================
echo.

REM Find and kill processes using port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process ID: %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Done! Port 8000 is now free.
echo.
pause
