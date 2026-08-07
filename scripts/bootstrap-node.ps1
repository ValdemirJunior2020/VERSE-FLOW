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
$temp = Join-Path $Runtime "node-unpack"
Write-Host "Downloading $url" -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $temp -Force
$inner = Get-ChildItem $temp -Directory | Select-Object -First 1
if (-not $inner) { throw "Node ZIP did not contain the expected directory." }
if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
Move-Item $inner.FullName $NodeDir
Remove-Item $temp -Recurse -Force
Remove-Item $zipPath -Force
Write-Host "Portable Node $version is ready in .runtime\node" -ForegroundColor Green
