$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Runtime = Join-Path $Root ".runtime"
$Marker = Join-Path $Runtime "node-path.txt"

function Write-Marker([string]$Value) {
  New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
  [System.IO.File]::WriteAllText($Marker, $Value, [System.Text.Encoding]::ASCII)
}

function Test-NodePair {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
  if (-not $node -or -not $npm) { return $false }
  try {
    $nodeVersion = (& $node.Source --version 2>$null).Trim()
    $npmVersion = (& $npm.Source --version 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $nodeVersion -or -not $npmVersion) { return $false }
    Write-Host "System Node already installed: $nodeVersion" -ForegroundColor Green
    Write-Host "System npm already installed: $npmVersion" -ForegroundColor Green
    Write-Host "Skipping portable Node download." -ForegroundColor Green
    Write-Marker "SYSTEM"
    return $true
  } catch { return $false }
}

# First choice: use an existing Windows Node/npm installation. Never download a
# second Node copy when both commands already work.
if (Test-NodePair) { exit 0 }

# Second choice: reuse a portable runtime installed by an earlier VerseFlow.
if (Test-Path -LiteralPath $Marker) {
  $saved = (Get-Content -LiteralPath $Marker -Raw -ErrorAction SilentlyContinue).Trim()
  if ($saved -and $saved -ne "SYSTEM" -and
      (Test-Path -LiteralPath (Join-Path $saved "node.exe")) -and
      (Test-Path -LiteralPath (Join-Path $saved "npm.cmd"))) {
    Write-Host "Portable Node already available: $saved" -ForegroundColor Green
    exit 0
  }
}

# Legacy V1.4.x local runtime support.
$LegacyNode = Join-Path $Runtime "node"
if ((Test-Path -LiteralPath (Join-Path $LegacyNode "node.exe")) -and
    (Test-Path -LiteralPath (Join-Path $LegacyNode "npm.cmd"))) {
  Write-Host "Portable Node already available in legacy .runtime\node." -ForegroundColor Green
  Write-Marker $LegacyNode
  exit 0
}

Write-Host "Node.js was not found on this PC." -ForegroundColor Yellow
Write-Host "Finding the latest Node.js 22 LTS x64 ZIP from nodejs.org..." -ForegroundColor Yellow
$index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
$release = $index | Where-Object { $_.version -like "v22.*" -and $_.lts } | Select-Object -First 1
if (-not $release) { throw "Could not find a Node.js 22 LTS release." }

$version = $release.version
$zipName = "node-$version-win-x64.zip"
$url = "https://nodejs.org/dist/$version/$zipName"

# Keep the portable runtime OUTSIDE the long Downloads/project path. npm ships
# deeply nested files and old Windows path handling can fail when VerseFlow was
# extracted several folders deep.
$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
if ([string]::IsNullOrWhiteSpace($localAppData)) { $localAppData = $env:TEMP }
$RuntimeBase = Join-Path $localAppData "VerseFlowRuntime"
$NodeDir = Join-Path $RuntimeBase "node-$version-win-x64"
$zipPath = Join-Path $env:TEMP ("verseflow-" + $zipName)

function Remove-Safely([string]$PathToRemove) {
  if ([string]::IsNullOrWhiteSpace($PathToRemove)) { return }
  if (Test-Path -LiteralPath $PathToRemove) {
    try { Remove-Item -LiteralPath $PathToRemove -Recurse -Force -ErrorAction Stop } catch {
      Write-Host "Cleanup warning: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
  }
}

try {
  New-Item -ItemType Directory -Force -Path $RuntimeBase | Out-Null
  if ((Test-Path -LiteralPath (Join-Path $NodeDir "node.exe")) -and
      (Test-Path -LiteralPath (Join-Path $NodeDir "npm.cmd"))) {
    Write-Host "Reusable portable Node already exists: $NodeDir" -ForegroundColor Green
    Write-Marker $NodeDir
    exit 0
  }

  Write-Host "Downloading $url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

  Remove-Safely $NodeDir

  $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
  if ($tar) {
    Write-Host "Extracting portable Node to a short AppData path..." -ForegroundColor DarkGray
    & $tar.Source -xf $zipPath -C $RuntimeBase
    if ($LASTEXITCODE -ne 0) { throw "Windows tar could not extract the Node ZIP." }
  } else {
    Write-Host "Extracting portable Node with .NET ZIP support..." -ForegroundColor DarkGray
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $RuntimeBase)
  }

  if (-not (Test-Path -LiteralPath (Join-Path $NodeDir "node.exe"))) {
    throw "Portable Node extraction completed but node.exe was not found."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $NodeDir "npm.cmd"))) {
    throw "Portable Node extraction completed but npm.cmd was not found."
  }

  Write-Marker $NodeDir
  Write-Host "Portable Node $version is ready." -ForegroundColor Green
  Write-Host "Runtime: $NodeDir" -ForegroundColor DarkGray
}
finally {
  Remove-Safely $zipPath
}
