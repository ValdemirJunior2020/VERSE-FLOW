$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Runtime = Join-Path $Root ".runtime"
$NodeDir = Join-Path $Runtime "node"

if (Test-Path (Join-Path $NodeDir "node.exe")) {
  Write-Host "Portable Node already available." -ForegroundColor Green
  exit 0
}

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

Write-Host "Finding the latest Node.js 22 LTS x64 ZIP from nodejs.org..." -ForegroundColor Yellow
$index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
$release = $index | Where-Object { $_.version -like "v22.*" -and $_.lts } | Select-Object -First 1
if (-not $release) { throw "Could not find a Node.js 22 LTS release." }

$version = $release.version
$zipName = "node-$version-win-x64.zip"
$url = "https://nodejs.org/dist/$version/$zipName"
$zipPath = Join-Path $Runtime $zipName

# Use a short, unique extraction directory. Some Windows 10 machines have
# problems with Expand-Archive cleanup when paths are long or contain spaces.
$temp = Join-Path $env:TEMP ("VerseFlow-Node-" + [Guid]::NewGuid().ToString("N"))

function Remove-Safely([string]$PathToRemove) {
  if ([string]::IsNullOrWhiteSpace($PathToRemove)) { return }
  if (Test-Path -LiteralPath $PathToRemove) {
    try { Remove-Item -LiteralPath $PathToRemove -Recurse -Force -ErrorAction Stop } catch {
      Write-Host "Cleanup warning: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
  }
}

try {
  Write-Host "Downloading $url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

  New-Item -ItemType Directory -Force -Path $temp | Out-Null

  # Prefer Windows' built-in tar.exe. It avoids a known PowerShell 5.1
  # Expand-Archive race where cleanup can fail with 'path does not exist'.
  $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
  if ($tar) {
    Write-Host "Extracting portable Node with Windows tar..." -ForegroundColor DarkGray
    & $tar.Source -xf $zipPath -C $temp
    if ($LASTEXITCODE -ne 0) { throw "Windows tar could not extract the Node ZIP." }
  } else {
    # Safe fallback for older Windows images without tar.exe.
    Write-Host "Extracting portable Node with .NET ZIP support..." -ForegroundColor DarkGray
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $temp)
  }

  $expectedName = "node-$version-win-x64"
  $inner = Join-Path $temp $expectedName
  if (-not (Test-Path -LiteralPath (Join-Path $inner "node.exe"))) {
    $found = Get-ChildItem -LiteralPath $temp -Directory -ErrorAction SilentlyContinue |
      Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "node.exe") } |
      Select-Object -First 1
    if ($found) { $inner = $found.FullName }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $inner "node.exe"))) {
    throw "Node ZIP did not contain node.exe in the expected directory."
  }

  Remove-Safely $NodeDir
  New-Item -ItemType Directory -Force -Path $NodeDir | Out-Null

  # Copy instead of Move-Item across TEMP/runtime volumes. This is more reliable
  # on machines where TEMP and Downloads resolve through different locations.
  Copy-Item -Path (Join-Path $inner "*") -Destination $NodeDir -Recurse -Force

  if (-not (Test-Path -LiteralPath (Join-Path $NodeDir "node.exe"))) {
    throw "Portable Node extraction completed but node.exe was not installed."
  }

  Write-Host "Portable Node $version is ready in .runtime\node" -ForegroundColor Green
}
finally {
  # Cleanup must never turn a successful install into INSTALL FAILED.
  Remove-Safely $temp
  Remove-Safely $zipPath
}
