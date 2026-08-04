@echo off
title FlowDownloader Automation Engine
cd /d "%~dp0"
echo ========================================================
echo   FlowDownloader Automation Engine
echo   Web GUI Dashboard: http://localhost:3000
echo ========================================================
echo.

echo [1/3] Terminating any existing background instances on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/3] Building latest TypeScript & Web assets...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Press any key to exit...
    pause
    exit /b 1
)

echo.
echo [3/3] Starting FlowDownloader Automation Engine & Web GUI...
echo.
node "%~dp0dist\index.js" start %*
if errorlevel 1 (
    echo.
    echo An error occurred while running FlowDownloader. Press any key to exit...
    pause
)
