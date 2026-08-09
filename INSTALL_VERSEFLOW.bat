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
  echo The installer stopped. Read the error shown above.
echo If package installation already passed, this is NOT automatically an internet problem.
  pause
  exit /b 1
)
echo.
echo Build finished. Opening release folder...
if exist "%~dp0release" start "" "%~dp0release"
pause
