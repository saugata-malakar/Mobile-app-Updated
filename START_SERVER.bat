@echo off
title DiabetesCare AI - Backend & Storage Server
cls
echo ========================================================================
echo                DIABETESCARE AI - LOCAL STORAGE & API SERVER
echo ========================================================================
echo.
echo PC Local IP: 192.168.31.94
echo Photos Directory: %~dp0stored_photos
echo Master Database:  %~dp0diabetescare.db
echo.
echo Freeing port 8000 if occupied...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)
echo Port 8000 ready.
echo.
echo Starting FastAPI Master Backend on http://0.0.0.0:8000 ...
echo Mobile devices on your Wi-Fi will connect to: http://192.168.31.94:8000
echo.
set PYTHONPATH=%~dp0Mobile-app-Updated;%PYTHONPATH%
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
pause
