@echo off
REM Generate Google Play Upload Keystore for DiabetesCare AI
REM Run from the Mobile-app-Updated root directory

set KEYSTORE_PATH=mobile-app\android\app\diabetescare-release.keystore
set PROPS_PATH=mobile-app\android\keystore.properties
set ALIAS=diabetescare_upload
set PASS=DiabetesCareKGP2026!

where keytool >nul 2>&1
if errorlevel 1 (
    if exist "%USERPROFILE%\.gradle\jdks\eclipse_adoptium-17-amd64-windows\jdk-17.0.20.1+1\bin\keytool.exe" (
        set KEYTOOL="%USERPROFILE%\.gradle\jdks\eclipse_adoptium-17-amd64-windows\jdk-17.0.20.1+1\bin\keytool.exe"
    ) else (
        echo ERROR: keytool not found on PATH. Install JDK 17 or add JAVA_HOME\bin to PATH.
        exit /b 1
    )
) else (
    set KEYTOOL=keytool
)

if exist "%KEYSTORE_PATH%" (
    echo Keystore already exists at %KEYSTORE_PATH%.
    echo Delete it manually first if you really want to regenerate ^(DO NOT do this after uploading to Google Play!^).
    exit /b 0
)

%KEYTOOL% -genkeypair -v -storetype PKCS12 -keystore "%KEYSTORE_PATH%" -alias %ALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass "%PASS%" -keypass "%PASS%" -dname "CN=DiabetesCare AI, OU=SNST, O=IIT Kharagpur and MMCH, L=Kharagpur, ST=West Bengal, C=IN"

if errorlevel 1 (
    echo Failed to generate keystore.
    exit /b 1
)

(
echo storeFile=diabetescare-release.keystore
echo storePassword=%PASS%
echo keyAlias=%ALIAS%
echo keyPassword=%PASS%
) > "%PROPS_PATH%"

echo.
echo SUCCESS: Upload keystore created at %KEYSTORE_PATH%
echo Signing properties written to %PROPS_PATH% ^(gitignored^).
echo IMPORTANT: Back up %KEYSTORE_PATH% and %PROPS_PATH% offline!
