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

Write-Host "`nBuilding Windows installer + portable executable..." -ForegroundColor Yellow
& npm run dist:win
if ($LASTEXITCODE -ne 0) { throw "Windows packaging failed." }

Write-Host "`nVerseFlow build complete." -ForegroundColor Green
Write-Host "Artifacts are in: $Root\release" -ForegroundColor Green
