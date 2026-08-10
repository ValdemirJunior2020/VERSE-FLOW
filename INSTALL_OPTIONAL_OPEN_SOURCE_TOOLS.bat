@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title VerseFlow Open Source Production Tools

set "TOOLS_DIR=%LOCALAPPDATA%\VerseFlowTools"
set "WHISPER_DIR=%TOOLS_DIR%\whisper"
set "NPM_GLOBAL=%TOOLS_DIR%\npm-global"
set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
set "YTDLP_EXE=%TOOLS_DIR%\yt-dlp.exe"
if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"
if not exist "%WHISPER_DIR%" mkdir "%WHISPER_DIR%"
if not exist "%NPM_GLOBAL%" mkdir "%NPM_GLOBAL%"

:menu
cls
echo ================================================================
echo   VERSEFLOW OPEN SOURCE PRODUCTION TOOLS
echo ================================================================
echo.
echo VerseFlow core works without these tools. Install only what you need.
echo All tools below are free/open source. Some Windows binaries are community builds.
echo.
echo [1]  Ollama + qwen3:0.6b       Smart Presenter local AI
echo [2]  yt-dlp + Deno              Permitted web-media importer
echo [3]  FFmpeg                     Convert, repair, probe media
echo [4]  mpv                        Professional media playback
echo [5]  whisper.cpp + base model   Offline live captions
echo [6]  OBS Studio                  Streaming, recording, camera scenes
echo [7]  HyperFrames                 Motion graphics and MP4 rendering
echo [8]  Bitfocus Companion          Stream Deck / hardware control
echo [9]  INSTALL ALL RECOMMENDED
echo [S]  Check status
echo [Q]  Quit
echo.
set /p choice=Choose: 
if "%choice%"=="1" goto ollama
if "%choice%"=="2" goto ytdlp
if "%choice%"=="3" goto ffmpeg
if "%choice%"=="4" goto mpv
if "%choice%"=="5" goto whisper
if "%choice%"=="6" goto obs
if "%choice%"=="7" goto hyperframes
if "%choice%"=="8" goto companion
if "%choice%"=="9" goto all
if /I "%choice%"=="S" goto status
if /I "%choice%"=="Q" exit /b 0
goto menu

:need_winget
where winget >nul 2>nul
if errorlevel 1 (
  echo.
  echo Windows Package Manager ^(winget^) is required for this installer option.
  echo Install or update "App Installer" from Microsoft Store, then run this file again.
  exit /b 1
)
exit /b 0

:install_ollama
where ollama >nul 2>nul
if not errorlevel 1 goto ollama_found
if exist "%OLLAMA_EXE%" goto ollama_found
echo Downloading Ollama using the official Windows installer script...
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://ollama.com/install.ps1 ^| iex"
if errorlevel 1 exit /b 1
:ollama_found
if not exist "%OLLAMA_EXE%" set "OLLAMA_EXE=ollama"
powershell -NoProfile -Command "try { Invoke-RestMethod http://127.0.0.1:11434/api/version -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Ollama" /min "%OLLAMA_EXE%" serve
  timeout /t 3 /nobreak >nul
)
echo Pulling lightweight qwen3:0.6b model...
"%OLLAMA_EXE%" pull qwen3:0.6b
exit /b %errorlevel%

:install_ytdlp
echo Downloading latest official yt-dlp.exe...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%YTDLP_EXE%'"
if errorlevel 1 exit /b 1
echo Installing Deno, the JavaScript runtime recommended by yt-dlp for full YouTube support...
call :need_winget || exit /b 1
winget install -e --id DenoLand.Deno --accept-package-agreements --accept-source-agreements
if errorlevel 1 echo WARNING: Deno install failed. yt-dlp can still work for many non-YouTube sources.
"%YTDLP_EXE%" --version
exit /b 0

:install_ffmpeg
call :need_winget || exit /b 1
echo Installing FFmpeg Windows build from the WinGet community repository...
winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
exit /b %errorlevel%

:install_mpv
call :need_winget || exit /b 1
echo Installing mpv Windows build by shinchiro...
winget install -e --id shinchiro.mpv --accept-package-agreements --accept-source-agreements
exit /b %errorlevel%

:install_whisper
echo Downloading latest whisper.cpp Windows x64 release...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $r=Invoke-RestMethod -Headers @{'User-Agent'='VerseFlow'} 'https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest'; $a=$r.assets | Where-Object { $_.name -match 'whisper-bin-x64.*\.zip$' } | Select-Object -First 1; if(-not $a){ throw 'Could not find whisper-bin-x64 zip in latest release.' }; $zip=Join-Path $env:TEMP 'verseflow-whisper.zip'; Invoke-WebRequest -UseBasicParsing $a.browser_download_url -OutFile $zip; if(Test-Path '%WHISPER_DIR%'){ Get-ChildItem '%WHISPER_DIR%' -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }; Expand-Archive -Path $zip -DestinationPath '%WHISPER_DIR%' -Force; Remove-Item $zip -Force"
if errorlevel 1 exit /b 1
echo Downloading multilingual Whisper base model ^(~142 MB^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true' -OutFile '%WHISPER_DIR%\ggml-base.bin'"
if errorlevel 1 exit /b 1
echo whisper.cpp and multilingual base model are ready.
exit /b 0

:install_obs
call :need_winget || exit /b 1
echo Installing OBS Studio. OBS WebSocket is built into OBS Studio 28+.
winget install -e --id OBSProject.OBSStudio --accept-package-agreements --accept-source-agreements
exit /b %errorlevel%

:ensure_npm
where npm >nul 2>nul
if not errorlevel 1 (
  set "NPM_CMD=npm"
  exit /b 0
)
if exist "%~dp0.runtime\node-path.txt" (
  set /p "VF_NODEDIR="<"%~dp0.runtime\node-path.txt"
  if not "!VF_NODEDIR!"=="" if /I not "!VF_NODEDIR!"=="SYSTEM" if exist "!VF_NODEDIR!\npm.cmd" (
    set "NPM_CMD=!VF_NODEDIR!\npm.cmd"
    exit /b 0
  )
)
if exist "%~dp0.runtime\node\npm.cmd" (
  set "NPM_CMD=%~dp0.runtime\node\npm.cmd"
  exit /b 0
)
call :need_winget || exit /b 1
echo Node.js is needed for HyperFrames. Installing Node.js LTS...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if errorlevel 1 exit /b 1
set "NPM_CMD=npm"
exit /b 0

:install_hyperframes
call :ensure_npm || exit /b 1
echo Installing HyperFrames CLI into VerseFlowTools...
"%NPM_CMD%" install -g hyperframes --prefix "%NPM_GLOBAL%"
exit /b %errorlevel%

:install_companion
call :need_winget || exit /b 1
echo Installing Bitfocus Companion for Stream Deck and hardware buttons...
winget install -e --id Bitfocus.Companion --accept-package-agreements --accept-source-agreements
exit /b %errorlevel%

:ollama
call :install_ollama
pause
goto menu
:ytdlp
call :install_ytdlp
pause
goto menu
:ffmpeg
call :install_ffmpeg
pause
goto menu
:mpv
call :install_mpv
pause
goto menu
:whisper
call :install_whisper
pause
goto menu
:obs
call :install_obs
pause
goto menu
:hyperframes
call :install_hyperframes
pause
goto menu
:companion
call :install_companion
pause
goto menu

:all
echo.
echo Installing the complete VerseFlow production toolset...
call :install_ollama
call :install_ytdlp
call :install_ffmpeg
call :install_mpv
call :install_whisper
call :install_obs
call :install_hyperframes
call :install_companion
echo.
echo Finished. Restart VerseFlow so newly installed tools are detected.
pause
goto menu

:status
cls
echo ================= VERSEFLOW TOOL STATUS =================
echo.
echo Ollama:
where ollama 2>nul || if exist "%OLLAMA_EXE%" echo %OLLAMA_EXE%
echo.
echo yt-dlp:
if exist "%YTDLP_EXE%" ("%YTDLP_EXE%" --version) else echo Not installed in VerseFlowTools
echo Deno runtime:
where deno 2>nul || echo Not found in PATH - restart Windows Terminal or VerseFlow after installation
echo.
echo FFmpeg:
where ffmpeg 2>nul || echo Not found in PATH
echo.
echo mpv:
where mpv 2>nul || echo Not found in PATH
echo.
echo whisper.cpp:
where whisper-stream 2>nul || dir /s /b "%WHISPER_DIR%\whisper-stream.exe" 2>nul
if exist "%WHISPER_DIR%\ggml-base.bin" echo Model: ggml-base.bin READY
 echo.
echo OBS Studio:
if exist "%ProgramFiles%\obs-studio\bin\64bit\obs64.exe" (echo Installed) else (echo Not found in default location)
echo.
echo HyperFrames:
if exist "%NPM_GLOBAL%\hyperframes.cmd" (call "%NPM_GLOBAL%\hyperframes.cmd" --version) else echo Not installed in VerseFlowTools
echo.
echo Bitfocus Companion:
where companion 2>nul || echo Check Windows Apps if installed.
echo.
pause
goto menu
