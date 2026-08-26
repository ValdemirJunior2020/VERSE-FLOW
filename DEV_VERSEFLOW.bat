@echo off
setlocal
cd /d "%~dp0"
title VerseFlow Development Mode

rem Prefer Node/npm already installed on Windows.
where node >nul 2>nul
if errorlevel 1 goto :portable
where npm >nul 2>nul
if errorlevel 1 goto :portable
echo Using Node already installed on this PC.
goto :node_ready

:portable
echo System Node/npm not found.
echo Preparing VerseFlow portable Node runtime...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
if errorlevel 1 goto :error

rem bootstrap-node.ps1 may have found system Node after all.
where node >nul 2>nul
if not errorlevel 1 (
  where npm >nul 2>nul
  if not errorlevel 1 goto :node_ready
)

if not exist ".runtime\node-path.txt" goto :error
set /p "NODEDIR="<".runtime\node-path.txt"
if "%NODEDIR%"=="" goto :error
if /I "%NODEDIR%"=="SYSTEM" goto :node_ready
if not exist "%NODEDIR%\node.exe" goto :error
if not exist "%NODEDIR%\npm.cmd" goto :error
set "PATH=%NODEDIR%;%PATH%"

:node_ready
node --version
if errorlevel 1 goto :error
npm --version
if errorlevel 1 goto :error
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
