@echo off
title FlowDownloader Automation Engine
cd /d "%~dp0"
echo ========================================================
echo   Launching FlowDownloader Automation Engine...
echo ========================================================
echo.
node "%~dp0dist\index.js" start %*
if errorlevel 1 (
    echo.
    echo An error occurred. Press any key to exit...
    pause
)
