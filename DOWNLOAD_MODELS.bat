@echo off
title DiabetesCare AI - Download Model Weights
cls
echo ========================================================================
echo        DIABETESCARE AI -- AUTOMATIC MODEL WEIGHTS DOWNLOADER
echo ========================================================================
echo.
echo Checking and downloading YOLO11 and SAM2 model weights...
echo Target: %~dp0models\sam2\
echo.
python "%~dp0scripts\download_models.py"
echo.
pause
