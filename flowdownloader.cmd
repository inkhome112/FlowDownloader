@echo off
title FlowDownloader Automation Engine
cd /d "%~dp0"
node "%~dp0dist\index.js" %*
if errorlevel 1 (
    echo.
    echo An error occurred. Press any key to exit...
    pause >nul
)
