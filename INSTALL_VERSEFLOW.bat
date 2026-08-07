@echo off
setlocal
cd /d "%~dp0"
title VerseFlow Installer
echo.
echo =========================================
echo        VERSEFLOW WINDOWS INSTALLER
echo =========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-verseflow.ps1"
if errorlevel 1 (
  echo.
  echo INSTALL FAILED.
  echo You can try DEV_VERSEFLOW.bat after checking your internet connection.
  pause
  exit /b 1
)
echo.
echo Build finished. Opening release folder...
if exist "%~dp0release" start "" "%~dp0release"
pause
