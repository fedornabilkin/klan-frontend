@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or later, then run this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing. Reinstall Node.js with npm.
  pause
  exit /b 1
)
if not exist "node_modules\.bin\vite.cmd" (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Starting Klan frontend. API must be running separately.
call npm run dev
set "KLAN_EXIT_CODE=%ERRORLEVEL%"
if not "%KLAN_EXIT_CODE%"=="0" pause
exit /b %KLAN_EXIT_CODE%
