# MATP - levanta el entorno completo con Docker Compose (equivale a: npm run dev)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 [-Down]
param([switch]$Down)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if ($Down) { npm run down; exit $LASTEXITCODE }
if (-not (Test-Path ".env")) {
    Write-Error "Falta .env. Copie .env.example como .env y revise los valores."
}
npm run dev
exit $LASTEXITCODE
