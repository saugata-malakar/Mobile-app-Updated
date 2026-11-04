@echo off
title DiabetesCare AI - Phone USB Debugging Connector
cls
echo ========================================================================
echo        DIABETESCARE AI -- PHONE USB DEBUGGING BRIDGE
echo ========================================================================
echo.

set ADB=%~dp0platform-tools\adb.exe

if not exist "%ADB%" (
    echo [ERROR] adb.exe not found in platform-tools.
    pause
    exit /b 1
)

echo Checking for connected Android phone via USB...
echo.

"%ADB%" devices > "%TEMP%\adb_devices.txt"
type "%TEMP%\adb_devices.txt"
echo.

findstr /C:"device" "%TEMP%\adb_devices.txt" | findstr /V "List of devices" >nul
if errorlevel 1 (
    findstr /C:"unauthorized" "%TEMP%\adb_devices.txt" >nul
    if errorlevel 0 (
        echo ------------------------------------------------------------------------
        echo [!] PHONE FOUND BUT WAITING FOR PERMISSION!
        echo Please look at your phone screen right now.
        echo Check the box 'Always allow from this computer' and tap 'Allow'.
        echo ------------------------------------------------------------------------
    ) else (
        echo ------------------------------------------------------------------------
        echo [!] NO PHONE DETECTED OVER USB.
        echo.
        echo Please ensure:
        echo   1. Your Android phone is plugged into the PC via a USB cable.
        echo   2. On your phone: Settings -^> About Phone -^> tap 'Build Number' 7 times.
        echo   3. Settings -^> Developer Options -^> Turn ON 'USB Debugging'.
        echo   4. If prompted on your phone, tap 'Allow USB Debugging'.
        echo ------------------------------------------------------------------------
    )
    echo.
    echo Press any key to retry...
    pause >nul
    goto :eof
)

echo [OK] Phone detected! Forwarding ports over USB...
echo.

"%ADB%" reverse tcp:7860 tcp:7860
if errorlevel 1 (
    echo [!] Could not forward port 7860.
) else (
    echo [*] Port 7860 [Interactive Wound UI] forwarded to phone successfully!
)

"%ADB%" reverse tcp:8000 tcp:8000
if errorlevel 1 (
    echo [!] Could not forward port 8000.
) else (
    echo [*] Port 8000 [FastAPI Backend API]  forwarded to phone successfully!
)

echo.
echo ========================================================================
echo                 CONNECTED OVER USB SUCCESSFULLY!
echo ========================================================================
echo.
echo How to test on your phone right now:
echo.
echo 1. Open Google Chrome on your phone.
echo 2. Type in the address bar:
echo.
echo        http://localhost:7860
echo.
echo 3. The Interactive Wound Segmentation interface will load on your phone!
echo 4. Tap the image box -^> choose 'Camera' -^> snap a photo of any wound or skin.
echo 5. Tap 'Segment Wound ^& Mark Boundaries'.
echo.
echo The PC runs YOLO11 + SAM2 and sends the marked boundary and
echo measurements directly back to your phone!
echo ========================================================================
echo.
pause
