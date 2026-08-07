@echo off
setlocal
cd /d "%~dp0"
title VerseFlow Development Mode

if not exist ".runtime\node\node.exe" (
  echo Portable Node runtime not found.
  echo Running bootstrap first...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
  if errorlevel 1 goto :error
)
set "PATH=%~dp0.runtime\node;%~dp0.runtime\node\node_modules\npm\bin;%PATH%"
call npm config set registry https://registry.npmjs.org/
if not exist "node_modules" (
  echo Installing npm packages...
  call npm install
  if errorlevel 1 goto :error
)
echo Starting VerseFlow...
call npm run dev
exit /b %errorlevel%

:error
echo.
echo Could not start VerseFlow.
pause
exit /b 1
