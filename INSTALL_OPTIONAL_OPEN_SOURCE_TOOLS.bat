@echo off
setlocal
cd /d "%~dp0"
title VerseFlow Optional Open Source Tools

if not exist ".runtime\node\node.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
  if errorlevel 1 goto :error
)
set "PATH=%~dp0.runtime\node;%~dp0.runtime\node\node_modules\npm\bin;%PATH%"

echo.
echo These tools are OPTIONAL. VerseFlow works without them.
echo.
echo [1] HyperFrames - cinematic HTML/CSS to MP4 renderer
echo [2] OmniRoute   - local OpenAI-compatible AI gateway
echo [3] Both
echo [4] Open documentation folder only
echo [Q] Quit
echo.
set /p choice=Choose: 

if /I "%choice%"=="1" goto hyper
if /I "%choice%"=="2" goto omni
if /I "%choice%"=="3" goto both
if /I "%choice%"=="4" goto docs
if /I "%choice%"=="Q" exit /b 0
goto :eof

:hyper
echo Installing HyperFrames into the portable Node runtime...
call npm install -g hyperframes
if errorlevel 1 goto :error
echo HyperFrames installed. FFmpeg is also required by HyperFrames.
goto :done

:omni
echo Installing OmniRoute into the portable Node runtime...
call npm install -g omniroute
if errorlevel 1 goto :error
echo OmniRoute installed.
echo Run: omniroute
echo Default API base: http://127.0.0.1:20128/v1
goto :done

:both
call npm install -g hyperframes omniroute
if errorlevel 1 goto :error
goto :done

:docs
start "" "%~dp0docs"
exit /b 0

:done
echo.
echo Optional tool installation finished.
pause
exit /b 0

:error
echo.
echo Optional tool install failed. VerseFlow itself is still usable.
pause
exit /b 1
