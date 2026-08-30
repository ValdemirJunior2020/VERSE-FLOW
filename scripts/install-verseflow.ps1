param([switch]$SkipTools)
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

Write-Host "`nChecking VerseFlow npm packages..." -ForegroundColor Yellow
$NeedNpmInstall = $true
if (Test-Path -LiteralPath (Join-Path $Root "node_modules")) {
  & npm ls --depth=0 *> $null
  if ($LASTEXITCODE -eq 0) {
    $NeedNpmInstall = $false
    Write-Host "VerseFlow npm packages are already installed and consistent. Skipping npm install." -ForegroundColor Green
  } else {
    Write-Host "Existing node_modules is incomplete or out of date. Repairing it..." -ForegroundColor Yellow
  }
}
if ($NeedNpmInstall) {
  Write-Host "Installing VerseFlow packages..." -ForegroundColor Yellow
  & npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
}

# Self-repair the source Bible catalog before tests. The runtime keeps an
# identical copy under electron\bible-catalog.json, so a partial Windows
# extraction/copy should not make the installer fail with ENOENT.
$SourceDataDir = Join-Path $Root "src\data"
$SourceCatalog = Join-Path $SourceDataDir "bible-catalog.json"
$RuntimeCatalog = Join-Path $Root "electron\bible-catalog.json"
if (-not (Test-Path -LiteralPath $SourceCatalog)) {
  Write-Host "`nRepairing missing src\data\bible-catalog.json..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path $SourceDataDir | Out-Null
  if (Test-Path -LiteralPath $RuntimeCatalog) {
    Copy-Item -LiteralPath $RuntimeCatalog -Destination $SourceCatalog -Force
    Write-Host "Bible catalog restored from the runtime copy." -ForegroundColor Green
  } else {
    throw "Bible catalog is missing from both src\data and electron. Re-extract the VerseFlow ZIP."
  }
}

# Give a clear error before Vitest if any catalog-referenced bundled Bible payload is missing.
$BundledBibleDir = Join-Path $Root "bibles\bundled"
$CatalogForVerify = Get-Content -LiteralPath $SourceCatalog -Raw | ConvertFrom-Json
$ExpectedBibleFiles = @($CatalogForVerify | ForEach-Object { if ($_.bundledFile) { $_.bundledFile }; if ($_.partialBundledFile) { $_.partialBundledFile } } | Where-Object { $_ } | Sort-Object -Unique)
$MissingBibleFiles = @($ExpectedBibleFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $BundledBibleDir $_)) })
if ($MissingBibleFiles.Count -gt 0) {
  throw "Bundled Bible files are incomplete. Missing: $($MissingBibleFiles -join ', '). Re-extract the full VerseFlow ZIP before installing."
}
Write-Host "Bundled Bible payload verified: $($ExpectedBibleFiles.Count) catalog files." -ForegroundColor DarkGray

if (-not $SkipTools) {
  Write-Host "`nChecking/installing missing VerseFlow tools..." -ForegroundColor Yellow
  & (Join-Path $Root "scripts\install-all-tools.ps1")
  if ($LASTEXITCODE -ne 0) { throw "VerseFlow tool installation failed." }
}

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

Write-Host "`nBuilding Windows installer and portable executable in SEPARATE staging folders..." -ForegroundColor Yellow
Write-Host "This prevents NSIS/7-Zip from reading a win-unpacked folder that another target can change." -ForegroundColor DarkGray

& npm run build
if ($LASTEXITCODE -ne 0) { throw "Vite production build failed." }

$NsisStage = ".verseflow-build-nsis-" + (Get-Date -Format "yyyyMMddHHmmss")
$PortableStage = ".verseflow-build-portable-" + (Get-Date -Format "yyyyMMddHHmmss")
$NsisStagePath = Join-Path $Root $NsisStage
$PortableStagePath = Join-Path $Root $PortableStage
$FinalOutput = Join-Path $Root $OutputName
New-Item -ItemType Directory -Force -Path $FinalOutput | Out-Null

try {
  Write-Host "`n[PACKAGE 1/2] Building NSIS installer in isolated staging..." -ForegroundColor Yellow
  & npx electron-builder --win nsis --x64 "--config.directories.output=$NsisStage"
  if ($LASTEXITCODE -ne 0) { throw "Windows NSIS packaging failed." }
  Get-ChildItem -LiteralPath $NsisStagePath -File -Filter *.exe | Copy-Item -Destination $FinalOutput -Force

  Write-Host "`n[PACKAGE 2/2] Building portable executable in separate isolated staging..." -ForegroundColor Yellow
  & npx electron-builder --win portable --x64 "--config.directories.output=$PortableStage"
  if ($LASTEXITCODE -ne 0) { throw "Windows portable packaging failed." }
  Get-ChildItem -LiteralPath $PortableStagePath -File -Filter *.exe | Copy-Item -Destination $FinalOutput -Force
} finally {
  Remove-Item -LiteralPath $NsisStagePath -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $PortableStagePath -Recurse -Force -ErrorAction SilentlyContinue
}

$BuiltExes = @(Get-ChildItem -LiteralPath $FinalOutput -File -Filter *.exe -ErrorAction SilentlyContinue)
if ($BuiltExes.Count -lt 2) { throw "Packaging finished but both Windows EXE artifacts were not found in $FinalOutput." }

$FinalOutput = Join-Path $Root $OutputName
Write-Host "`nVerseFlow build complete." -ForegroundColor Green
Write-Host "Artifacts are in: $FinalOutput" -ForegroundColor Green
try { Start-Process explorer.exe $FinalOutput } catch {}
