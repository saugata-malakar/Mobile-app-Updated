@echo off
echo ========================================
echo STARTING WOUND SEVERITY MODEL TRAINING
echo ========================================
echo.
echo This will train the model on your dataset.
echo Training will take 1-2 hours.
echo.
echo Press Ctrl+C to stop training at any time.
echo.
pause

cd ml\wound_severity
python train_simple.py

pause
