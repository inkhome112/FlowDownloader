@echo off
title Stop FlowDownloader Engine
cd /d "%~dp0"
echo ========================================================
echo   Stopping FlowDownloader Automation Engine...
echo ========================================================
echo.

echo Terminating processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
    echo Terminated process PID: %%a
)

echo.
echo FlowDownloader cleanly stopped. Press any key to close window.
timeout /t 3 >nul
