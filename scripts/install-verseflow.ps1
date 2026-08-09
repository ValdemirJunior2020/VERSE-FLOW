$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
& (Join-Path $Root "scripts\bootstrap-node.ps1")
$NodeDir = Join-Path $Root ".runtime\node"
$env:PATH = "$NodeDir;$NodeDir\node_modules\npm\bin;$env:PATH"
Set-Location $Root

Write-Host "`nNode:" -ForegroundColor DarkGray
& node --version
Write-Host "npm:" -ForegroundColor DarkGray
& npm --version

Write-Host "`nUsing official npm registry..." -ForegroundColor Yellow
& npm config set registry "https://registry.npmjs.org/"

Write-Host "`nInstalling VerseFlow packages..." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

Write-Host "`nRunning critical tests..." -ForegroundColor Yellow
& npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed. Installer stopped before packaging." }

# VerseFlow/Electron can keep Windows DLLs and the unpacked EXE locked if the
# previous build is still open. Close those processes before touching output.
Write-Host "`nChecking for any running VerseFlow build before packaging..." -ForegroundColor Yellow
# Do not use taskkill directly here. With $ErrorActionPreference = "Stop",
# taskkill returns an error when the process does not exist and can abort an
# otherwise healthy installation. Only stop matching processes when present.
$runningVerseFlow = Get-Process -Name "VerseFlow" -ErrorAction SilentlyContinue
if ($runningVerseFlow) {
  Write-Host "Closing VerseFlow..." -ForegroundColor DarkGray
  $runningVerseFlow | Stop-Process -Force -ErrorAction SilentlyContinue
}

$runningElectron = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($runningElectron) {
  Write-Host "Closing Electron development window..." -ForegroundColor DarkGray
  $runningElectron | Stop-Process -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 750

$OutputName = "release"
$ReleaseDir = Join-Path $Root $OutputName
if (Test-Path $ReleaseDir) {
  try {
    Remove-Item $ReleaseDir -Recurse -Force -ErrorAction Stop
  } catch {
    # Some Windows/antivirus states leave an old unpacked EXE undeletable.
    # Never block a church build because an OLD release folder is locked.
    $OutputName = "release-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    Write-Host "Old release folder is locked. Building safely into $OutputName instead." -ForegroundColor Yellow
  }
}

Write-Host "`nBuilding Windows installer + portable executable..." -ForegroundColor Yellow
if ($OutputName -eq "release") {
  & npm run dist:win
} else {
  & npm run build
  if ($LASTEXITCODE -eq 0) {
    & npx electron-builder --win nsis portable --x64 "--config.directories.output=$OutputName"
  }
}
if ($LASTEXITCODE -ne 0) { throw "Windows packaging failed." }

$FinalOutput = Join-Path $Root $OutputName
Write-Host "`nVerseFlow build complete." -ForegroundColor Green
Write-Host "Artifacts are in: $FinalOutput" -ForegroundColor Green
try { Start-Process explorer.exe $FinalOutput } catch {}
