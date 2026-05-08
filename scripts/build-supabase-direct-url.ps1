# Ejecutar en la terminal integrada de Cursor (PowerShell), no desde el chat del agente:
#   cd "...\Sofware de Cotizaciones"
#   .\scripts\build-supabase-direct-url.ps1
#
# Pide la contraseña de forma oculta y deja la URI Direct completa en el portapapeles.

$ErrorActionPreference = "Stop"

$ref = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "cwbgwedntdnivssjtlfm" }
$hostDirect = "db.$ref.supabase.co"

Write-Host ""
Write-Host "  Supabase Direct → DATABASE_DIRECT_URL"
Write-Host "  Host: $hostDirect"
Write-Host ""

$sec = Read-Host "  Contraseña de la base (Supabase Database)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($plain)) {
  Write-Host "  Contraseña vacía. Cancelado." -ForegroundColor Red
  exit 1
}

$enc = [Uri]::EscapeDataString($plain)
$directUrl = "postgresql://postgres:${enc}@${hostDirect}:5432/postgres?sslmode=require"

Set-Clipboard -Value $directUrl

$repoRoot = Split-Path $PSScriptRoot -Parent
$outFile = Join-Path $repoRoot "apps\api\.env.railway.generated"
$fileBody = @"
# Generado por scripts/build-supabase-direct-url.ps1 — NO commitear
DATABASE_DIRECT_URL=$directUrl

# Pegue DATABASE_URL (Session pooler) desde Supabase → Database → Connection string
"@

try {
  Set-Content -Path $outFile -Value $fileBody -Encoding UTF8
} catch {
  Write-Host "  (No se pudo escribir $outFile )" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Listo: la URL completa quedó en el portapapeles (Ctrl+V en Railway)." -ForegroundColor Green
Write-Host "  Archivo: $outFile"
Write-Host ""
