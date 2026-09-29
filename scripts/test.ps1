# MATP - lint y pruebas de todos los proyectos (equivale a: npm run lint; npm test)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/test.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test
exit $LASTEXITCODE
