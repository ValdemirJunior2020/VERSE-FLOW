param(
  [switch]$StatusOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ToolsDir = Join-Path $env:LOCALAPPDATA 'VerseFlowTools'
$InternetRoot = Join-Path $env:LOCALAPPDATA 'VerseFlow\InternetAgent'
$WhisperDir = Join-Path $ToolsDir 'whisper'
$YtDlpExe = Join-Path $ToolsDir 'yt-dlp.exe'

New-Item -ItemType Directory -Force -Path $ToolsDir,$WhisperDir,$InternetRoot | Out-Null

function Say([string]$Text,[ConsoleColor]$Color='Gray'){ Write-Host $Text -ForegroundColor $Color }
function Has-Cmd([string]$Name){ return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }
function Winget-Has([string]$Id){
  if(-not (Has-Cmd 'winget.exe')){ return $false }
  $out = & winget list -e --id $Id --accept-source-agreements 2>$null | Out-String
  return ($LASTEXITCODE -eq 0 -and $out -match [regex]::Escape($Id))
}
function Winget-Install([string]$Id){
  if(-not (Has-Cmd 'winget.exe')){ throw "WinGet is required to install $Id. Install/update 'App Installer' from Microsoft Store, then run INSTALL_VERSEFLOW.bat again." }
  if(Winget-Has $Id){
    Say "  $Id is already installed according to WinGet. Skipping." Green
    return
  }

  # IMPORTANT: send WinGet's progress text to the host, not into PowerShell's
  # success-output pipeline. Callers such as Ensure-Python assign this function's
  # return value to a variable; leaked WinGet text would otherwise become part of
  # the executable path and produce a giant "command not found" string.
  & winget install -e --id $Id --source winget --accept-package-agreements --accept-source-agreements | Out-Host
  $code = $LASTEXITCODE
  if($code -ne 0){
    # WinGet sometimes returns a non-zero code for an already-installed package
    # or when there is simply no newer version. Re-check before treating it as fatal.
    if(Winget-Has $Id){
      Say "  $Id is installed. Continuing." Green
      return
    }
    throw "WinGet failed installing $Id (exit code $code)"
  }
}
function Find-Mpv {
  $cmd = Get-Command mpv.exe -ErrorAction SilentlyContinue
  if($cmd){ return $cmd.Source }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\mpv\mpv.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\mpv.exe'),
    (Join-Path $env:ProgramFiles 'mpv\mpv.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'mpv\mpv.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }
  if($candidates){ return $candidates[0] }
  if(Winget-Has 'shinchiro.mpv'){ return 'WINGET_INSTALLED' }
  return $null
}
function Test-RealPython([string]$Candidate){
  if(-not $Candidate -or -not (Test-Path $Candidate)){ return $false }
  try{
    $ver = (& $Candidate -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null | Select-Object -Last 1).Trim()
    if(-not $ver){ return $false }
    return ([version]$ver -ge [version]'3.11')
  }catch{ return $false }
}

function Find-RealPython {
  $candidates = New-Object System.Collections.Generic.List[string]

  # Prefer the normal python.org per-user installs. These are not Microsoft
  # Store execution aliases and work reliably for venv creation.
  foreach($p in @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    (Join-Path $env:ProgramFiles 'Python313\python.exe'),
    (Join-Path $env:ProgramFiles 'Python312\python.exe'),
    (Join-Path $env:ProgramFiles 'Python311\python.exe')
  )){ if($p){ $candidates.Add($p) } }

  # Then inspect commands on PATH, but reject aliases/stubs that cannot really
  # execute Python code.
  foreach($name in @('python.exe','python','py.exe','py')){
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if($cmd -and $cmd.Source){
      if($name -like 'py*'){
        try{
          $resolved = (& $cmd.Source -3.12 -c "import sys; print(sys.executable)" 2>$null | Select-Object -Last 1).Trim()
          if($resolved){ $candidates.Add($resolved) }
        }catch{}
      } else {
        $candidates.Add([string]$cmd.Source)
      }
    }
  }

  foreach($candidate in ($candidates | Select-Object -Unique)){
    if(Test-RealPython $candidate){ return [string]$candidate }
  }
  return $null
}

function Ensure-Python {
  $found = Find-RealPython
  if($found){
    Say "  Python 3.11+ ready: $found" Green
    return [string]$found
  }

  Say '  Real Python 3.11+ was not found. Installing Python 3.12...' Yellow
  Winget-Install 'Python.Python.3.12'

  # Refresh detection after WinGet. Do not trust WinGet output as a path.
  $found = Find-RealPython
  if(-not $found){
    $known = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
    if(Test-RealPython $known){ $found = $known }
  }
  if(-not $found){ throw 'Python 3.11+ could not be found after installation. Close this window, reopen it, and run INSTALL_VERSEFLOW.bat again.' }

  Say "  Python 3.12 installed and ready: $found" Green
  return [string]$found
}
function Ensure-Venv([string]$Name){
  $dir = Join-Path $InternetRoot $Name
  $py = Join-Path $dir 'Scripts\python.exe'
  if(-not (Test-Path $py)){
    $globalPy = Ensure-Python
    Say "  Creating isolated Python environment: $Name" Yellow
    & $globalPy -m venv $dir
    if($LASTEXITCODE -ne 0){ throw "Could not create $Name environment." }
  }
  return $py
}
function Python-Has([string]$Py,[string]$Module){
  # Missing modules are expected during first-run setup. Do not let Python's
  # normal ImportError/traceback become a terminating PowerShell NativeCommandError.
  if(-not $Py -or -not (Test-Path $Py)){ return $false }
  $probe = "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec(" + ([char]39) + $Module + ([char]39) + ") else 1)"
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Py
    $psi.Arguments = '-c ' + ('"' + $probe.Replace('"','\"') + '"')
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $proc.StandardOutput.ReadToEnd() | Out-Null
    $proc.StandardError.ReadToEnd() | Out-Null
    $proc.WaitForExit()
    return $proc.ExitCode -eq 0
  } catch {
    return $false
  }
}
function Tool-Status {
  Say '================ VERSEFLOW TOOL STATUS ================' Cyan
  if(Has-Cmd 'node.exe'){ Say "Node: $(& node --version)" } else { Say 'Node: MISSING' }
  if(Has-Cmd 'npm.cmd'){ Say "npm: $(& npm --version)" } else { Say 'npm: MISSING' }
  $ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if(-not $ollama){ $p=Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'; if(Test-Path $p){$ollama=[pscustomobject]@{Source=$p}} }
  if($ollama){Say 'Ollama: installed'}else{Say 'Ollama: MISSING'}
  if(Test-Path $YtDlpExe){Say 'yt-dlp: installed'}else{Say 'yt-dlp: MISSING'}
  if(Has-Cmd 'deno.exe'){Say 'Deno: installed'}else{Say 'Deno: MISSING'}
  if(Has-Cmd 'ffmpeg.exe'){Say 'FFmpeg: installed'}else{Say 'FFmpeg: MISSING'}
  $mpv=Find-Mpv; if($mpv){Say 'mpv: installed'}else{Say 'mpv: MISSING'}
  $whisperExe = Get-ChildItem $WhisperDir -Filter whisper-stream.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if((Test-Path (Join-Path $WhisperDir 'ggml-base.bin')) -and $whisperExe){Say 'whisper.cpp: installed'}else{Say 'whisper.cpp: MISSING'}
  if(Test-Path "$env:ProgramFiles\obs-studio\bin\64bit\obs64.exe"){Say 'OBS Studio: installed'}else{Say 'OBS Studio: MISSING'}
  $companion = (Test-Path "$env:ProgramFiles\Companion\Companion.exe") -or (Test-Path "$env:LOCALAPPDATA\Programs\companion\Companion.exe")
  if($companion){Say 'Bitfocus Companion: installed'}else{Say 'Bitfocus Companion: MISSING'}
  $ar=Join-Path $InternetRoot 'agent-reach\Scripts\agent-reach.exe'; if(Test-Path $ar){Say 'Agent-Reach: installed'}else{Say 'Agent-Reach: MISSING'}
  $cp=Join-Path $InternetRoot 'crawl4ai\Scripts\python.exe'; if((Test-Path $cp) -and (Python-Has $cp 'crawl4ai')){Say 'Crawl4AI: installed'}else{Say 'Crawl4AI: MISSING'}
  $bp=Join-Path $InternetRoot 'browser-use\Scripts\python.exe'; if((Test-Path $bp) -and (Python-Has $bp 'browser_use')){Say 'Browser Use: installed'}else{Say 'Browser Use: MISSING'}
  if(Test-Path (Join-Path $InternetRoot 'node\node_modules\mcporter\package.json')){Say 'mcporter/Exa: installed'}else{Say 'mcporter/Exa: MISSING'}
}

if($StatusOnly){ Tool-Status; exit 0 }

Say '==============================================================' Cyan
Say '       VERSEFLOW SMART TOOL CHECK + INSTALL' Cyan
Say '==============================================================' Cyan
Say 'Existing working tools are skipped. Missing tools are installed.' Green
Say 'Python agent tools stay isolated under LOCALAPPDATA.' DarkGray

# Ollama + model
Say "`n[TOOLS 1/10] Ollama + qwen3:0.6b" Yellow
$ollamaPath = $null
$oc = Get-Command ollama.exe -ErrorAction SilentlyContinue
if($oc){ $ollamaPath=$oc.Source }
if(-not $ollamaPath){ $candidate=Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'; if(Test-Path $candidate){$ollamaPath=$candidate} }
if(-not $ollamaPath){
  Say '  Ollama missing. Installing...' Yellow
  Invoke-RestMethod 'https://ollama.com/install.ps1' | Invoke-Expression
  $oc=Get-Command ollama.exe -ErrorAction SilentlyContinue; if($oc){$ollamaPath=$oc.Source}
  if(-not $ollamaPath){$candidate=Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'; if(Test-Path $candidate){$ollamaPath=$candidate}}
}
if(-not $ollamaPath){ throw 'Ollama install finished but ollama.exe could not be found.' }
try{ Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 | Out-Null }catch{ Start-Process -WindowStyle Hidden -FilePath $ollamaPath -ArgumentList 'serve'; Start-Sleep 3 }
$list=& $ollamaPath list 2>$null
if($list -notmatch 'qwen3:0\.6b'){ Say '  Pulling qwen3:0.6b...' Yellow; & $ollamaPath pull qwen3:0.6b; if($LASTEXITCODE -ne 0){throw 'Ollama model download failed.'} } else { Say '  Already ready. Skipping.' Green }

# yt-dlp + deno
Say "`n[TOOLS 2/10] yt-dlp + Deno" Yellow
if(-not (Test-Path $YtDlpExe)){ Invoke-WebRequest -UseBasicParsing 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $YtDlpExe } else { Say '  yt-dlp already installed.' Green }
if(-not (Has-Cmd 'deno.exe')){ Winget-Install 'DenoLand.Deno' } else { Say '  Deno already installed.' Green }

Say "`n[TOOLS 3/10] FFmpeg" Yellow
if(-not (Has-Cmd 'ffmpeg.exe')){ Winget-Install 'Gyan.FFmpeg' } else { Say '  Already installed.' Green }
Say "`n[TOOLS 4/10] mpv" Yellow
$mpv=Find-Mpv
if(-not $mpv){ Winget-Install 'shinchiro.mpv' } else { Say '  Already installed. Skipping.' Green }

Say "`n[TOOLS 5/10] whisper.cpp + base model" Yellow
$whisperExe=Get-ChildItem $WhisperDir -Filter whisper-stream.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if(-not $whisperExe){
  $r=Invoke-RestMethod -Headers @{'User-Agent'='VerseFlow'} 'https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest'
  $a=$r.assets | Where-Object { $_.name -match 'whisper-bin-x64.*\.zip$' } | Select-Object -First 1
  if(-not $a){throw 'Could not find the latest whisper.cpp Windows x64 ZIP.'}
  $zip=Join-Path $env:TEMP 'verseflow-whisper.zip'; Invoke-WebRequest -UseBasicParsing $a.browser_download_url -OutFile $zip
  Get-ChildItem $WhisperDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive $zip $WhisperDir -Force; Remove-Item $zip -Force
} else { Say '  whisper.cpp already installed.' Green }
$wm=Join-Path $WhisperDir 'ggml-base.bin'; if(-not (Test-Path $wm)){Invoke-WebRequest -UseBasicParsing 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true' -OutFile $wm}else{Say '  Whisper model already installed.' Green}

Say "`n[TOOLS 6/10] OBS Studio" Yellow
if(-not (Test-Path "$env:ProgramFiles\obs-studio\bin\64bit\obs64.exe")){ Winget-Install 'OBSProject.OBSStudio' } else { Say '  Already installed.' Green }

Say "`n[TOOLS 7/10] Bitfocus Companion" Yellow
$companion=(Test-Path "$env:ProgramFiles\Companion\Companion.exe") -or (Test-Path "$env:LOCALAPPDATA\Programs\companion\Companion.exe")
if(-not $companion){ Winget-Install 'Bitfocus.Companion' } else { Say '  Already installed.' Green }

# Internet tools
Say "`n[TOOLS 8/10] Agent-Reach + mcporter/Exa" Yellow
$agentPy=Ensure-Venv 'agent-reach'
if(-not (Python-Has $agentPy 'agent_reach')){ & $agentPy -m pip install --upgrade pip; & $agentPy -m pip install 'https://github.com/Panniantong/agent-reach/archive/main.zip'; if($LASTEXITCODE -ne 0){throw 'Agent-Reach install failed.'} } else { Say '  Agent-Reach already installed.' Green }
$nodeRoot=Join-Path $InternetRoot 'node'; $mcPkg=Join-Path $nodeRoot 'node_modules\mcporter\package.json'
if(-not (Test-Path $mcPkg)){ & npm install --prefix $nodeRoot mcporter; if($LASTEXITCODE -ne 0){throw 'mcporter install failed.'} } else { Say '  mcporter already installed.' Green }
$mcInfo=Get-Content $mcPkg -Raw | ConvertFrom-Json; $bin=$mcInfo.bin.mcporter; if(-not $bin -and $mcInfo.bin -is [string]){$bin=$mcInfo.bin}; if(-not $bin){$bin=($mcInfo.bin.psobject.Properties | Select-Object -First 1).Value}
$mcJs=Join-Path (Split-Path $mcPkg -Parent) $bin
& node $mcJs config add exa https://mcp.exa.ai/mcp --scope home *> $null

Say "`n[TOOLS 9/10] Crawl4AI" Yellow
$crawlPy=Ensure-Venv 'crawl4ai'
if(-not (Python-Has $crawlPy 'crawl4ai')){ & $crawlPy -m pip install --upgrade pip; & $crawlPy -m pip install crawl4ai; if($LASTEXITCODE -ne 0){throw 'Crawl4AI install failed.'} } else { Say '  Crawl4AI already installed.' Green }
$setup=Join-Path (Split-Path $crawlPy -Parent) 'crawl4ai-setup.exe'; if(Test-Path $setup){ & $setup; if($LASTEXITCODE -ne 0){Say '  Browser setup incomplete; VerseFlow can use its reader fallback.' DarkYellow} }
& $crawlPy -m pip check; if($LASTEXITCODE -ne 0){throw 'Crawl4AI dependency check failed.'}

Say "`n[TOOLS 10/10] Browser Use (isolated optional fallback)" Yellow
$browserPy=Ensure-Venv 'browser-use'
if(-not (Python-Has $browserPy 'browser_use')){ & $browserPy -m pip install --upgrade pip; & $browserPy -m pip install browser-use; if($LASTEXITCODE -ne 0){ Say '  Browser Use optional install failed; normal internet search still works.' DarkYellow } } else { Say '  Browser Use already installed.' Green }
if(Python-Has $browserPy 'browser_use'){ & $browserPy -m pip check; if($LASTEXITCODE -ne 0){Say '  Browser Use has a dependency warning inside its own isolated environment.' DarkYellow} }

Say "`nAll missing VerseFlow tools are installed or checked." Green
Tool-Status
