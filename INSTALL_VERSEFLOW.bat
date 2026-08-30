@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
chcp 65001 >nul
title VerseFlow Smart One-File Installer

echo.
echo ==============================================================
echo        VERSEFLOW ONE-FILE SMART WINDOWS INSTALLER
echo ==============================================================
echo Checks first. Existing working software is SKIPPED.
echo Installs only what is missing.
echo Does NOT modify .git or .env files.
echo ==============================================================
echo.

if /I "%~1"=="--status" goto status
if /I "%~1"=="--tools-only" goto tools_entry
if /I "%~1"=="--dev" goto dev
if /I "%~1"=="--check" goto check

rem When this BAT is bundled inside an installed VerseFlow app there is no
rem source package.json beside it. In that case it automatically becomes a
rem tools-only installer instead of trying to rebuild VerseFlow.
if not exist "%~dp0package.json" goto tools_entry

rem Ensure Node/npm exists before tool checks because mcporter needs npm.
where node >nul 2>nul
if errorlevel 1 goto bootstrap_node
where npm >nul 2>nul
if errorlevel 1 goto bootstrap_node
goto node_ready

:bootstrap_node
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
if errorlevel 1 goto fail
if exist "%~dp0.runtime\node-path.txt" (
  set /p "VF_NODEDIR="<"%~dp0.runtime\node-path.txt"
  if /I not "!VF_NODEDIR!"=="SYSTEM" if not "!VF_NODEDIR!"=="" set "PATH=!VF_NODEDIR!;!PATH!"
)

:node_ready
echo [1/2] Checking/installing all VerseFlow tools...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-all-tools.ps1"
if errorlevel 1 goto fail

echo.
echo [2/2] Checking VerseFlow source, tests, and Windows build...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-verseflow.ps1" -SkipTools
if errorlevel 1 goto fail

goto success

:tools_entry
call :ensure_node
if errorlevel 1 goto fail

:tools
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-all-tools.ps1"
if errorlevel 1 goto fail
goto success

:status
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-all-tools.ps1" -StatusOnly
pause
exit /b %errorlevel%

:dev
if not exist "%~dp0package.json" (
  echo Development mode is only available from the VerseFlow source folder.
  goto fail
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
if errorlevel 1 goto fail
if not exist "%~dp0node_modules" call npm install
if errorlevel 1 goto fail
call npm run dev
exit /b %errorlevel%

:check
if not exist "%~dp0package.json" (
  echo Developer checks are only available from the VerseFlow source folder.
  goto fail
)
if not exist "%~dp0node_modules" call npm install
if errorlevel 1 goto fail
call npm test
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
call npm run test:e2e
if errorlevel 1 goto fail
echo [PASS] VerseFlow tests/build/E2E passed.
pause
exit /b 0

:ensure_node
where node >nul 2>nul
if errorlevel 1 goto ensure_bootstrap
where npm >nul 2>nul
if not errorlevel 1 exit /b 0
:ensure_bootstrap
if not exist "%~dp0scripts\bootstrap-node.ps1" (
  echo Node/npm are missing and bootstrap-node.ps1 is not available.
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
if errorlevel 1 exit /b 1
if exist "%~dp0.runtime\node-path.txt" (
  set /p "VF_NODEDIR="<"%~dp0.runtime\node-path.txt"
  if /I not "!VF_NODEDIR!"=="SYSTEM" if not "!VF_NODEDIR!"=="" set "PATH=!VF_NODEDIR!;!PATH!"
)
where node >nul 2>nul || exit /b 1
where npm >nul 2>nul || exit /b 1
exit /b 0

:success
echo.
echo ==============================================================
echo [READY] VerseFlow setup completed.
echo Existing tools were not reinstalled unnecessarily.
echo ==============================================================
echo.
if exist "%~dp0release" start "" "%~dp0release"
pause
exit /b 0

:fail
echo.
echo ==============================================================
echo [ERROR] Setup stopped. Read the error above.
echo Your .git and .env files were not modified by this installer.
echo ==============================================================
pause
exit /b 1
