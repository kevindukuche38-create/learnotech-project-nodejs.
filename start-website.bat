@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js 22.5 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
node server.js
pause
