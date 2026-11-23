<#
.SYNOPSIS
  Restores a pg_dump custom-format file (from backup_db.ps1) into a running
  Postgres container. Defaults to luers_postgres/luers_db — pass -ContainerName
  to target a scratch container instead (see docs/postgres-backup-runbook.md's
  restore drill).

.EXAMPLE
  .\scripts\restore_db.ps1 -DumpFile "backups\luers_db_2026-08-01_143000.dump"

.EXAMPLE
  .\scripts\restore_db.ps1 -DumpFile "backups\luers_db_2026-08-01_143000.dump" -ContainerName luers_pg_restore_drill
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$DumpFile,
    [string]$ContainerName = "luers_postgres",
    [string]$DbName = "luers_db",
    [string]$DbUser = "luers_user"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpFile)) {
    throw "Dump file not found: $DumpFile"
}
$DumpFile = (Resolve-Path $DumpFile).Path

$running = docker ps --filter "name=$ContainerName" --format "{{.Names}}"
if (-not $running) {
    throw "Container '$ContainerName' is not running."
}

$remotePath = "/tmp/restore_$(Get-Date -Format 'yyyyMMddHHmmss').dump"

Write-Host "Copying $DumpFile into ${ContainerName}:${remotePath} ..."
docker cp $DumpFile "${ContainerName}:${remotePath}"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }

Write-Host "Restoring into '$DbName' (--clean --if-exists: drops existing objects first, so this is safe to re-run) ..."
docker exec $ContainerName pg_restore -U $DbUser -d $DbName --clean --if-exists $remotePath
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }

docker exec $ContainerName rm -f $remotePath

Write-Host "Restore complete into '$DbName' on container '$ContainerName'."
