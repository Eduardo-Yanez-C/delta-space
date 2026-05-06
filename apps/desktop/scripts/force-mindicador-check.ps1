$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\HP VICTUS SERIES PRO\Desktop\Sofware de cotrizaciones"
$exePath = Join-Path $repoRoot "apps\desktop\dist\Aplicacion de traslado\Cotizaciones PFV Avanzada.exe"

if (!(Test-Path $exePath)) {
  throw "No se encontró el exe: $exePath"
}

Write-Output "[FORCE] Starting portable exe..."
$p = Start-Process -FilePath $exePath -PassThru
Write-Output ("[FORCE] started pid=" + $p.Id)

$deadline = (Get-Date).AddSeconds(240)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:4000/api/health" -TimeoutSec 5
    if ($health -ne $null -and $health.ok -eq $true) { $ready = $true; break }
  } catch {
    Start-Sleep -Seconds 1
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  throw "Backend no listo en 240s (revisar arranque embebido)"
}

Write-Output "[FORCE] backend is healthy."

$email = "eduardo.yanez.concha@gmail.com"
$password = "admin123"
$body = @{ email = $email; password = $password } | ConvertTo-Json

Write-Output "[FORCE] logging in..."
$login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4000/api/auth/login" -ContentType "application/json" -Body $body
$token = $login.accessToken

if (-not $token) {
  throw "No accessToken returned by login"
}

$headers = @{ Authorization = "Bearer " + $token }

Write-Output "[FORCE] requesting external indicators..."
for ($i=1; $i -le 10; $i++) {
  Write-Output ("[FORCE] indicators call attempt " + $i + " ...")
  $ind = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:4000/api/dashboard/external-indicators" -Headers $headers
  Write-Output "[FORCE] indicators response received."
  if ($ind.error -ne $null) { Write-Output ("[FORCE] indicators error field=" + $ind.error) }
  $ind | Out-String | Write-Output
  # Esperar caso "válido": debe venir sin error y con al menos dólar y UF con valor.
  $hasValues = ($ind.error -eq $null -or $ind.error -eq "") -and ($ind.dolar.value -ne $null) -and ($ind.uf.value -ne $null)
  if ($hasValues) {
    Write-Output "[FORCE] indicators look usable; continuing to series..."
    break
  }
  Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 2

Write-Output "[FORCE] requesting external indicators SERIES..."
$periods = @("weekly","monthly","yearly")
foreach ($period in $periods) {
  Write-Output ("[FORCE] series period=" + $period)
  $series = Invoke-RestMethod -Method Get -Uri ("http://127.0.0.1:4000/api/dashboard/external-indicators/series?period=" + $period) -Headers $headers
  $dCount = if ($series.dolar -eq $null) { -1 } else { $series.dolar.Count }
  $uCount = if ($series.uf -eq $null) { -1 } else { $series.uf.Count }
  $iCount = if ($series.ipc -eq $null) { -1 } else { $series.ipc.Count }
  Write-Output ("[FORCE] counts dolar=" + $dCount + " uf=" + $uCount + " ipc=" + $iCount + " error=" + $series.error)
}

Write-Output "[FORCE] locating backend.log..."
$roots = @($env:APPDATA, $env:LOCALAPPDATA)
$logCandidates = @()
foreach ($root in $roots) {
  if ($root -and (Test-Path $root)) {
    $items = Get-ChildItem -Path $root -Recurse -Filter "backend.log" -ErrorAction SilentlyContinue
    foreach ($it in $items) { $logCandidates += $it.FullName }
  }
}
$logCandidates = $logCandidates | Select-Object -Unique
Write-Output ("[FORCE] backend.log candidates: " + $logCandidates.Count)

if ($logCandidates.Count -eq 0) {
  throw "No backend.log found under AppData/LocalAppData"
}

$logToRead = $logCandidates | Sort-Object -Property LastWriteTime -Descending | Select-Object -First 1
Write-Output ("[FORCE] reading: " + $logToRead)

$content = Get-Content $logToRead -Tail 1200
$mindLines = $content | Select-String -Pattern "\[MINDICADOR\]|\[PVWATTS-DEBUG\]|\[SOLAR\]|\[SERIES-DEBUG\]" -SimpleMatch

Write-Output "[FORCE] matched integration lines:"
$mindLines | ForEach-Object { $_.Line }

Write-Output "[FORCE] stopping portable exe..."
taskkill /IM "Cotizaciones PFV Avanzada.exe" /T /F | Out-Null

return

