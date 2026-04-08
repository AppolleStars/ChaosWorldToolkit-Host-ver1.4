#Requires -Version 5.1
# Run from this folder:
#   Set-Location <path>\cloud\worker; .\setup.ps1
#
# If Chinese comments in other files look garbled in the console, run once:
#   chcp 65001

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Reduce mojibake on Windows PowerShell 5.x (UTF-8 output)
try {
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        cmd /c "chcp 65001>nul"
    }
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {}

Write-Host "=== ChaosWorldToolkit cloud Worker setup ===" -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm not found. Install Node.js LTS: https://nodejs.org/  (then reopen PowerShell)" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/4] npm install ..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/4] wrangler login (browser) ..." -ForegroundColor Yellow
npx wrangler login
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[3/4] Create KV namespace SNAPSHOT (production) ..." -ForegroundColor Yellow
npx wrangler kv namespace create SNAPSHOT
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[4/4] Create KV namespace SNAPSHOT --preview ..." -ForegroundColor Yellow
npx wrangler kv namespace create SNAPSHOT --preview
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path ".dev.vars")) {
    Copy-Item -Path ".dev.vars.example" -Destination ".dev.vars" -Force
    Write-Host "`nCreated .dev.vars from .dev.vars.example (do not commit .dev.vars)" -ForegroundColor Green
} else {
    Write-Host "`n.dev.vars already exists, skip copy" -ForegroundColor DarkGray
}

Write-Host @"

=== Next steps (manual) ===
1) Copy the two KV ids from the output above into wrangler.toml:
   [[kv_namespaces]]
   binding = "SNAPSHOT"
   id = "<production namespace id>"
   preview_id = "<preview namespace id>"

2) Production secrets (recommended):
     npx wrangler secret put TEAMS_CONFIG
     npx wrangler secret put ADMIN_READ_TOKEN
   TEAMS_CONFIG: paste one line from TEAMS_CONFIG.oneline.txt
   ADMIN_READ_TOKEN: see ADMIN_READ_TOKEN.example.txt (use your own random value in prod)

3) Deploy:
     npx wrangler deploy

4) Edit cloud/config.local.js -> CLOUD_WORKER_BASE = https://<your>.workers.dev

5) Set ALLOWED_ORIGIN to your static site origin in wrangler.toml [vars] or Cloudflare Dashboard

"@ -ForegroundColor Green
