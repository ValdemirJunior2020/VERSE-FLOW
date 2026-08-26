$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
& (Join-Path $Root "scripts\bootstrap-node.ps1")
if ($LASTEXITCODE -ne 0) { throw "Node bootstrap failed." }

# bootstrap-node.ps1 prefers system Node/npm. If they are not available, it
# writes the reusable portable runtime location to .runtime\node-path.txt.
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }

if (-not $node -or -not $npm) {
  $Marker = Join-Path $Root ".runtime\node-path.txt"
  if (-not (Test-Path -LiteralPath $Marker)) { throw "Node/npm are unavailable and no portable runtime marker was created." }
  $NodeDir = (Get-Content -LiteralPath $Marker -Raw).Trim()
  if (-not $NodeDir -or $NodeDir -eq "SYSTEM") { throw "Portable Node path is invalid." }
  if (-not (Test-Path -LiteralPath (Join-Path $NodeDir "node.exe"))) { throw "Portable node.exe was not found at $NodeDir" }
  if (-not (Test-Path -LiteralPath (Join-Path $NodeDir "npm.cmd"))) { throw "Portable npm.cmd was not found at $NodeDir" }
  $env:PATH = "$NodeDir;$env:PATH"
}

Set-Location $Root
Write-Host "`nNode:" -ForegroundColor DarkGray
& node --version
if ($LASTEXITCODE -ne 0) { throw "Node could not start." }
Write-Host "npm:" -ForegroundColor DarkGray
& npm --version
if ($LASTEXITCODE -ne 0) { throw "npm could not start." }

Write-Host "`nUsing official npm registry..." -ForegroundColor Yellow
& npm config set registry "https://registry.npmjs.org/"

Write-Host "`nInstalling VerseFlow packages..." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

Write-Host "`nRunning critical tests..." -ForegroundColor Yellow
& npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed. Installer stopped before packaging." }

Write-Host "`nChecking for any running VerseFlow build before packaging..." -ForegroundColor Yellow
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
  try { Remove-Item $ReleaseDir -Recurse -Force -ErrorAction Stop }
  catch {
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
