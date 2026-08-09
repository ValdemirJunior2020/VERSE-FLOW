@echo off
setlocal
cd /d "%~dp0"
title VerseFlow Developer Check

echo ============================================
echo      VERSEFLOW RELIABILITY CHECK
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Node.js was not found.
  echo Use INSTALL_VERSEFLOW.bat first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

echo.
echo [1/3] Unit tests...
call npm test
if errorlevel 1 goto :fail

echo.
echo [2/3] Production build...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [3/3] Electron user-flow test...
call npm run test:e2e
if errorlevel 1 goto :fail

echo.
echo ============================================
echo [PASS] VERSEFLOW IS READY FOR TESTING
echo ============================================
pause
exit /b 0

:fail
echo.
echo ============================================
echo [FAIL] VERSEFLOW NEEDS ATTENTION
echo Copy the error above before changing code.
echo ============================================
pause
exit /b 1
