@echo off
title DiabetesCare AI - Interactive Wound Model Testing
cls
echo ========================================================================
echo        DIABETESCARE AI - INTERACTIVE WOUND MODEL TESTER
echo ========================================================================
echo.
echo Launching Interactive Testing Interface...
echo Open your browser to: http://localhost:7860
echo.
set PYTHONPATH=%~dp0;%PYTHONPATH%
set PYTHONIOENCODING=utf-8
python scripts/interactive_ui.py
pause
