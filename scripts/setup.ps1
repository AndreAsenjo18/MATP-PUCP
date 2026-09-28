# MATP - prepara el entorno de desarrollo (equivale a: npm install; npm run setup)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Se creo .env a partir de .env.example"
}
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run setup
exit $LASTEXITCODE
