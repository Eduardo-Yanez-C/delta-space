# Respaldo del archivo SQLite usado en desarrollo (Prisma file:).
# Ejecutar desde apps/api:  powershell -File prisma/scripts/backup-sqlite.ps1
# Opcional: $env:SOURCE_DATABASE_URL = "file:./mi-base.sqlite"

$ErrorActionPreference = "Stop"
$apiRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $apiRoot "package.json"))) {
  Write-Error "Ejecute este script desde el repo; apiRoot=$apiRoot"
}

$url = $env:SOURCE_DATABASE_URL
if (-not $url) { $url = "file:./dev.sqlite" }

if (-not $url.StartsWith("file:")) {
  Write-Error "SOURCE_DATABASE_URL debe ser file:./ruta (actual: $url)"
}

$rel = $url.Substring("file:".Length)
if ($rel.StartsWith("//")) { $rel = $rel.Substring(2) }
$dbPath = if ($rel -match '^/|^[A-Za-z]:') {
  [System.IO.Path]::GetFullPath($rel)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $apiRoot $rel))
}

if (-not (Test-Path -LiteralPath $dbPath)) {
  Write-Error "No existe el archivo SQLite: $dbPath"
}

$backupDir = Join-Path $apiRoot "prisma\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $backupDir ("sqlite-backup-" + $stamp + ".sqlite")
Copy-Item -LiteralPath $dbPath -Destination $dest

$item = Get-Item -LiteralPath $dest
Write-Host "Copia OK: $($item.FullName) ($($item.Length) bytes)"
