<#
.SYNOPSIS
  Backs up the local LUERS Postgres (Docker Compose container luers_postgres)
  to a timestamped custom-format pg_dump file under backend/backups/.

.EXAMPLE
  .\scripts\backup_db.ps1
#>
param(
    [string]$ContainerName = "luers_postgres",
    [string]$DbName = "luers_db",
    [string]$DbUser = "luers_user",
    [string]$OutDir = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"

$running = docker ps --filter "name=$ContainerName" --format "{{.Names}}"
if (-not $running) {
    throw "Container '$ContainerName' is not running. Start it with 'docker compose up -d' first."
}

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile = Join-Path $OutDir "${DbName}_${timestamp}.dump"

Write-Host "Backing up '$DbName' from container '$ContainerName' to $outFile ..."

# -Fc: custom format, required for selective/parallel pg_restore later
# (unlike a plain-text SQL dump). Runs inside the container so it never
# needs the host-mapped port.
#
# Routed through cmd.exe's `>` rather than PowerShell's pipeline/redirection:
# PowerShell reads a native command's stdout as text and re-encodes it,
# which corrupts pg_dump's binary custom-format output. cmd.exe's `>` is a
# raw OS-level file-handle redirect and preserves the bytes exactly.
cmd /c "docker exec $ContainerName pg_dump -U $DbUser -Fc $DbName > `"$outFile`""

if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}

$size = (Get-Item $outFile).Length
Write-Host "Backup complete: $outFile ($size bytes)"
